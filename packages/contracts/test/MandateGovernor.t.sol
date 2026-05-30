// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {VotesToken} from "../src/VotesToken.sol";
import {MandateGovernor} from "../src/MandateGovernor.sol";

contract MandateGovernorTest is Test {
    VotesToken internal token;
    MandateGovernor internal gov;
    address internal voter = makeAddr("voter");

    uint256 internal constant SEED = 1000 ether;

    function setUp() public {
        // Non-zero start so the timestamp clock and getPast* lookups are well-defined.
        vm.warp(1_700_000_000);
        token = new VotesToken(address(this));
        gov = new MandateGovernor(token, "Mandate Governor (TEST)");

        // Seed voting power to the voter BEFORE any proposal snapshot.
        token.mint(voter, SEED);
        vm.prank(voter);
        token.delegate(voter);
        vm.warp(block.timestamp + 1); // delegation checkpoint now strictly in the past
    }

    // --- helpers --------------------------------------------------------------

    function _propose(string memory description) internal returns (uint256 proposalId) {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeCall(token.totalSupply, ()); // benign; never executed
        proposalId = gov.propose(targets, values, calldatas, description);
    }

    function _toActive(uint256 proposalId) internal {
        vm.warp(gov.proposalSnapshot(proposalId) + 1);
        assertEq(uint256(gov.state(proposalId)), uint256(IGovernor.ProposalState.Active));
    }

    // --- tests ----------------------------------------------------------------

    function test_TokenAndGovernorUseTimestampClock() public view {
        assertEq(token.CLOCK_MODE(), "mode=timestamp");
        assertEq(token.clock(), uint48(block.timestamp));
        assertEq(gov.CLOCK_MODE(), "mode=timestamp");
        assertEq(gov.clock(), uint48(block.timestamp));
    }

    function test_GovernorSettingsMatchSpec() public view {
        assertEq(gov.votingDelay(), 60);
        assertEq(gov.votingPeriod(), 300);
        assertEq(gov.proposalThreshold(), 0);
    }

    function test_VoterHasPowerAtSnapshot() public {
        uint256 id = _propose("snapshot power");
        uint256 snapshot = gov.proposalSnapshot(id);
        _toActive(id);
        assertEq(gov.getVotes(voter, snapshot), SEED);
    }

    function test_ProposeWarpActiveCastVoteSucceeds() public {
        uint256 id = _propose("happy path");
        assertEq(uint256(gov.state(id)), uint256(IGovernor.ProposalState.Pending));

        _toActive(id);
        vm.prank(voter);
        gov.castVote(id, 1); // For

        assertTrue(gov.hasVoted(id, voter));
        (uint256 against, uint256 forVotes, uint256 abstain) = gov.proposalVotes(id);
        assertEq(forVotes, SEED);
        assertEq(against, 0);
        assertEq(abstain, 0);

        vm.warp(gov.proposalDeadline(id) + 1);
        assertEq(uint256(gov.state(id)), uint256(IGovernor.ProposalState.Succeeded));
    }

    function test_DoubleVoteOnSameProposalReverts() public {
        uint256 id = _propose("double vote");
        _toActive(id);

        vm.prank(voter);
        gov.castVote(id, 1);

        vm.prank(voter);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorAlreadyCastVote.selector, voter));
        gov.castVote(id, 1);
    }

    function test_FreshProposalNotBlockedByPriorVote() public {
        // Baseline for the T7 revoke-cause proof: "already voted" is strictly per-proposal,
        // so a fresh-proposal revert there must be caused by the disabled root delegation,
        // not by a lingering vote.
        uint256 a = _propose("proposal A");
        _toActive(a);
        vm.prank(voter);
        gov.castVote(a, 1);

        uint256 b = _propose("proposal B");
        _toActive(b);
        vm.prank(voter);
        gov.castVote(b, 1); // must NOT revert
        assertTrue(gov.hasVoted(b, voter));
    }
}
