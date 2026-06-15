// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

/**
 * MandateDelegation.fork.t.sol: deterministic, reproducible proof of Regent's safety invariant.
 *
 * Forks Base Sepolia and redeems a REAL 2-hop ERC-7710 delegation chain (root account →
 * orchestrator → analyst) through the REAL deployed MetaMask DelegationManager + stock
 * CaveatEnforcers. It turns the "trust the live demo" claim into committed, deterministic proof:
 *   1. honest castVote(lockedProposalId, support)        -> SUCCEEDS (lands on the target)
 *   2. transfer(...) on the same target                  -> REVERTS at AllowedMethodsEnforcer
 *   3. castVote(WRONG proposalId, support)               -> REVERTS at AllowedCalldataEnforcer
 *   4. after disableDelegation(root), honest redeem      -> REVERTS (CannotUseADisabledDelegation)
 *   5. castVote pointed at a DIFFERENT contract          -> REVERTS at AllowedTargetsEnforcer
 *
 * Negative cases assert the SPECIFIC revert reason (enforcer string / DelegationManager custom
 * error), so a pass proves the gate fired at the named enforcer, not somewhere earlier in the call.
 * The fork is pinned to a block for deterministic, reproducible runs (see DEFAULT_FORK_BLOCK).
 *
 * Mirrors packages/shared/src/delegation.ts `castVoteScope`: targets=[governor],
 * selectors=[castVote(uint256,uint8)], allowedCalldata locks proposalId at byte offset 4.
 *
 * The root delegator is a minimal `MockDeleGator` (EIP-1271 + ERC-7579 executeFromExecutor), the
 * smallest faithful stand-in for the production MetaMask smart account, so the DelegationManager
 * can both validate the root signature and execute the authorized call. The orchestrator is a
 * plain EOA signer (real ECDSA). The point this proves is the on-chain *enforcer* behaviour, which
 * is identical regardless of which DeleGator implementation roots the chain.
 *
 * RUN:
 *   cd packages/contracts
 *   # put these in packages/contracts/.env (foundry auto-loads it):
 *   #   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
 *   #   DELEGATION_MANAGER=0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3
 *   #   ALLOWED_TARGETS_ENFORCER=0x7F20f61b1f09b08D970938F6fa563634d65c4EeB
 *   #   ALLOWED_METHODS_ENFORCER=0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5
 *   #   ALLOWED_CALLDATA_ENFORCER=0xc2b0d624c1c4319760C96503BA27C347F3260f55
 *   # (resolve the three enforcers for any chain via getSmartAccountsEnvironment(chainId).caveatEnforcers)
 *   forge test --match-path test/MandateDelegation.fork.t.sol -vvv
 */

// --- Minimal local mirror of the delegation-framework ABI (avoids a new submodule) ---------------

struct Caveat {
    address enforcer;
    bytes terms;
    bytes args;
}

struct Delegation {
    address delegate;
    address delegator;
    bytes32 authority;
    Caveat[] caveats;
    uint256 salt;
    bytes signature;
}

interface IDelegationManager {
    function getDelegationHash(Delegation calldata delegation) external view returns (bytes32);
    function getDomainHash() external view returns (bytes32);
    function redeemDelegations(
        bytes[] calldata permissionContexts,
        bytes32[] calldata modes,
        bytes[] calldata executionCallDatas
    ) external;
    function disableDelegation(Delegation calldata delegation) external;
}

/// Thrown by the DelegationManager when redeeming a delegation whose root has been disabled
/// (selector 0x05baa052). Declared here so the kill-switch test can assert it by name.
error CannotUseADisabledDelegation();

/// Smallest faithful root account: validates any signature (EIP-1271) and executes a single
/// ERC-7579 call. Stands in for the production MetaMask Hybrid DeleGator for this enforcement test.
contract MockDeleGator {
    bytes4 internal constant EIP1271_MAGIC = 0x1626ba7e;

    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        return EIP1271_MAGIC;
    }

    // ERC-7579 single execution: _executionCalldata = abi.encodePacked(target, value, callData)
    function executeFromExecutor(bytes32, bytes calldata _executionCalldata)
        external
        payable
        returns (bytes[] memory returnData_)
    {
        address target = address(bytes20(_executionCalldata[0:20]));
        uint256 value = uint256(bytes32(_executionCalldata[20:52]));
        bytes calldata callData = _executionCalldata[52:];
        (bool ok, bytes memory ret) = target.call{value: value}(callData);
        require(ok, "MockDeleGator: exec failed");
        returnData_ = new bytes[](1);
        returnData_[0] = ret;
    }

    receive() external payable {}
}

/// Tiny vote target so the *honest* path lands somewhere real; the enforcers do the gating.
contract MockGovernor {
    mapping(uint256 => uint256) public forVotes;
    mapping(uint256 => uint256) public againstVotes;

    function castVote(uint256 proposalId, uint8 support) external returns (uint256) {
        if (support == 1) forVotes[proposalId] += 1;
        else againstVotes[proposalId] += 1;
        return 1;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true; // a "wrong method" target; redemption should never reach it
    }
}

contract MandateDelegationForkTest is Test {
    // ROOT_AUTHORITY = bytes32(type(uint256).max) per the delegation framework.
    bytes32 internal constant ROOT_AUTHORITY = bytes32(type(uint256).max);
    // ERC-7579 single-call, default exec-type mode.
    bytes32 internal constant MODE_SINGLE_DEFAULT = bytes32(0);

    bytes4 internal constant CAST_VOTE_SEL = bytes4(keccak256("castVote(uint256,uint8)"));
    bytes4 internal constant TRANSFER_SEL = bytes4(keccak256("transfer(address,uint256)"));

    IDelegationManager internal dm;
    address internal allowedTargets;
    address internal allowedMethods;
    address internal allowedCalldata;

    MockGovernor internal gov;
    MockDeleGator internal root; // the user's smart account (root delegator + voter)

    Vm.Wallet internal orchestrator; // mid delegator (EOA signer)
    Vm.Wallet internal analyst; // leaf delegate / redeemer (EOA)

    uint256 internal constant LOCKED_PID = 4242;
    uint256 internal constant WRONG_PID = 9999;

    // Pinned for deterministic, reproducible runs. The stock enforcers and DelegationManager are
    // long-deployed, so any recent block works; serve a pinned historical block from an archive RPC
    // (e.g. Alchemy Base Sepolia). Override with FORK_BLOCK to re-pin to your RPC's available window.
    uint256 internal constant DEFAULT_FORK_BLOCK = 42881536;

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"), vm.envOr("FORK_BLOCK", DEFAULT_FORK_BLOCK));

        dm = IDelegationManager(
            vm.envOr("DELEGATION_MANAGER", 0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3)
        );
        allowedTargets = vm.envAddress("ALLOWED_TARGETS_ENFORCER");
        allowedMethods = vm.envAddress("ALLOWED_METHODS_ENFORCER");
        allowedCalldata = vm.envAddress("ALLOWED_CALLDATA_ENFORCER");

        gov = new MockGovernor();
        root = new MockDeleGator();
        orchestrator = vm.createWallet("orchestrator");
        analyst = vm.createWallet("analyst");

        // The deterministic vm wallet addresses can coincidentally carry code / an EIP-7702
        // delegation designator on the live fork, which would force the DelegationManager down
        // the EIP-1271 path and break ECDSA verification. Clear it so signers are plain EOAs.
        vm.etch(orchestrator.addr, "");
        vm.etch(analyst.addr, "");
    }

    // ----------------------------- caveat construction (mirrors castVoteScope) -------------------

    function _castVoteCaveats(uint256 lockedProposalId) internal view returns (Caveat[] memory cav) {
        cav = new Caveat[](3);
        // AllowedTargets: only the governor.
        cav[0] = Caveat({enforcer: allowedTargets, terms: abi.encodePacked(address(gov)), args: ""});
        // AllowedMethods: only castVote(uint256,uint8).
        cav[1] = Caveat({enforcer: allowedMethods, terms: abi.encodePacked(CAST_VOTE_SEL), args: ""});
        // AllowedCalldata: lock proposalId (32 bytes) at offset 4 (after the selector). `support` free.
        cav[2] = Caveat({
            enforcer: allowedCalldata,
            terms: abi.encodePacked(uint256(4), abi.encode(lockedProposalId)),
            args: ""
        });
    }

    function _signLeaf(Delegation memory d) internal view returns (bytes memory) {
        bytes32 structHash = dm.getDelegationHash(d);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", dm.getDomainHash(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(orchestrator.privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    /// Build the 2-hop chain locked to `lockedProposalId`; returns (permissionContext, root delegation).
    function _buildChain(uint256 lockedProposalId)
        internal
        view
        returns (bytes memory permissionContext, Delegation memory rootDel)
    {
        // ROOT: root account -> orchestrator. The MockDeleGator validates any signature (EIP-1271),
        // so the root signature is intentionally empty.
        rootDel = Delegation({
            delegate: orchestrator.addr,
            delegator: address(root),
            authority: ROOT_AUTHORITY,
            caveats: _castVoteCaveats(lockedProposalId),
            salt: 1,
            signature: ""
        });

        // LEAF (attenuated): orchestrator -> analyst, authority = hash(root)
        Delegation memory leaf = Delegation({
            delegate: analyst.addr,
            delegator: orchestrator.addr,
            authority: dm.getDelegationHash(rootDel),
            caveats: _castVoteCaveats(lockedProposalId),
            salt: 2,
            signature: ""
        });
        leaf.signature = _signLeaf(leaf);

        // permissionContext = abi.encode(Delegation[] leaf..root)  (leaf first)
        Delegation[] memory chain = new Delegation[](2);
        chain[0] = leaf;
        chain[1] = rootDel;
        permissionContext = abi.encode(chain);
    }

    function _redeem(bytes memory permissionContext, bytes memory executionCallData) internal {
        bytes[] memory ctxs = new bytes[](1);
        ctxs[0] = permissionContext;
        bytes32[] memory modes = new bytes32[](1);
        modes[0] = MODE_SINGLE_DEFAULT;
        bytes[] memory execs = new bytes[](1);
        execs[0] = executionCallData;
        // The leaf delegate (analyst) is the authorised redeemer.
        vm.prank(analyst.addr);
        dm.redeemDelegations(ctxs, modes, execs);
    }

    /// ERC-7579 single execution calldata = abi.encodePacked(target, value, callData)
    function _exec(address target, bytes memory callData) internal pure returns (bytes memory) {
        return abi.encodePacked(target, uint256(0), callData);
    }

    // ----------------------------------------- tests ---------------------------------------------

    /// 1. Honest castVote on the locked proposal succeeds and lands on-chain.
    function test_honestVote_passes() public {
        (bytes memory ctx,) = _buildChain(LOCKED_PID);
        bytes memory call = abi.encodeWithSelector(CAST_VOTE_SEL, LOCKED_PID, uint8(1));
        _redeem(ctx, _exec(address(gov), call));
        assertEq(gov.forVotes(LOCKED_PID), 1, "honest vote should be recorded");
    }

    /// 2. A transfer() execution is rejected by the AllowedMethods caveat.
    ///    (verified on Base Sepolia: reverts with `AllowedMethodsEnforcer:method-not-allowed`)
    function test_transfer_revertsAtAllowedMethods() public {
        (bytes memory ctx,) = _buildChain(LOCKED_PID);
        bytes memory call = abi.encodeWithSelector(TRANSFER_SEL, address(0xdead), uint256(1e18));
        vm.expectRevert("AllowedMethodsEnforcer:method-not-allowed");
        _redeem(ctx, _exec(address(gov), call));
    }

    /// 3. castVote on a DIFFERENT proposalId is rejected by the AllowedCalldata caveat.
    ///    (verified on Base Sepolia: reverts with `AllowedCalldataEnforcer:invalid-calldata`)
    function test_wrongProposalId_revertsAtAllowedCalldata() public {
        (bytes memory ctx,) = _buildChain(LOCKED_PID);
        bytes memory call = abi.encodeWithSelector(CAST_VOTE_SEL, WRONG_PID, uint8(1));
        vm.expectRevert("AllowedCalldataEnforcer:invalid-calldata");
        _redeem(ctx, _exec(address(gov), call));
    }

    /// 4. Disabling the ROOT delegation cascade-revokes the whole chain (the kill switch).
    function test_disableRoot_cascadeReverts() public {
        (bytes memory ctx, Delegation memory rootDel) = _buildChain(LOCKED_PID);

        // sanity: honest vote works before revocation
        bytes memory call = abi.encodeWithSelector(CAST_VOTE_SEL, LOCKED_PID, uint8(1));
        _redeem(ctx, _exec(address(gov), call));
        assertEq(gov.forVotes(LOCKED_PID), 1, "precondition: vote works pre-revoke");

        // the root account disables its own root delegation -> the whole chain becomes unredeemable
        vm.prank(address(root));
        dm.disableDelegation(rootDel);

        vm.expectRevert(CannotUseADisabledDelegation.selector);
        _redeem(ctx, _exec(address(gov), call));
    }

    /// 5. A castVote pointed at a DIFFERENT contract is rejected by the AllowedTargets caveat
    ///    (honest selector + calldata, but the target is not the authorized governor).
    function test_wrongTarget_revertsAtAllowedTargets() public {
        (bytes memory ctx,) = _buildChain(LOCKED_PID);
        bytes memory call = abi.encodeWithSelector(CAST_VOTE_SEL, LOCKED_PID, uint8(1));
        address otherTarget = address(new MockGovernor());
        vm.expectRevert("AllowedTargetsEnforcer:target-address-not-allowed");
        _redeem(ctx, _exec(otherTarget, call));
    }
}
