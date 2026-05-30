// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MandateGovernor} from "../src/MandateGovernor.sol";

/// @notice Create one demo proposal on an already-deployed Governor and print its id/window.
///         The action is a benign view call (never executed in the demo — we only vote + recall).
///         A distinct PROPOSAL_DESCRIPTION yields a fresh proposalId (used by the T6 reseed helper).
///
/// Run:
///   GOVERNOR_ADDRESS=0x.. TOKEN_ADDRESS=0x.. forge script script/Propose.s.sol \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --broadcast
contract Propose is Script {
    function run() external returns (uint256 proposalId) {
        MandateGovernor governor = MandateGovernor(payable(vm.envAddress("GOVERNOR_ADDRESS")));
        address token = vm.envAddress("TOKEN_ADDRESS");
        string memory description =
            vm.envOr("PROPOSAL_DESCRIPTION", string("Mandate demo: signal proposal"));

        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        targets[0] = token;
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("totalSupply()"); // benign; never executed

        vm.startBroadcast();
        proposalId = governor.propose(targets, values, calldatas, description);
        vm.stopBroadcast();

        console2.log("proposalId :", proposalId);
        console2.log("snapshot   :", governor.proposalSnapshot(proposalId));
        console2.log("deadline   :", governor.proposalDeadline(proposalId));
    }
}
