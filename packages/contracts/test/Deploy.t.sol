// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {VotesToken} from "../src/VotesToken.sol";
import {MandateGovernor} from "../src/MandateGovernor.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

/// Proves the Deploy script's deploy + seed path locally, so the only thing the live
/// run adds is a real broadcast with the user's funded deployer key.
contract DeployScriptTest is Test {
    function test_DeployScriptSeedsVoterVotingPower() public {
        address voter = makeAddr("voter");
        vm.warp(1_700_000_000);
        vm.setEnv("VOTER_ADDRESS", vm.toString(voter));

        Deploy deploy = new Deploy();
        (VotesToken token, MandateGovernor governor) = deploy.run();

        // voter is seeded + auto-self-delegated (the script's require() also asserts this)
        assertEq(token.getVotes(voter), 1000 ether);
        assertEq(token.delegates(voter), voter);

        // and that power is visible at a fresh proposal's snapshot
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("totalSupply()");
        uint256 id = governor.propose(targets, values, calldatas, "seed proof");

        vm.warp(governor.proposalSnapshot(id) + 1);
        assertEq(uint256(governor.state(id)), uint256(IGovernor.ProposalState.Active));
        assertEq(governor.getVotes(voter, governor.proposalSnapshot(id)), 1000 ether);
    }
}
