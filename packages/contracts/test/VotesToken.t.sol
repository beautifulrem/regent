// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {VotesToken} from "../src/VotesToken.sol";

contract VotesTokenTest is Test {
    VotesToken internal token;
    address internal voter = makeAddr("voter");

    function setUp() public {
        vm.warp(1_700_000_000);
        token = new VotesToken(address(this));
    }

    function test_MintAutoSelfDelegatesVotingPower() public {
        // A bare mint (no separate delegate call) must activate voting power,
        // so a smart-account voter is seeded without sending its own UserOp.
        token.mint(voter, 1000 ether);
        assertEq(token.delegates(voter), voter);
        assertEq(token.getVotes(voter), 1000 ether);

        vm.warp(block.timestamp + 1);
        assertEq(token.getPastVotes(voter, block.timestamp - 1), 1000 ether);
    }

    function test_MintDoesNotOverrideAnExistingDelegation() public {
        address other = makeAddr("other");
        vm.prank(voter);
        token.delegate(other); // voter chose a delegate first

        token.mint(voter, 500 ether);
        assertEq(token.delegates(voter), other); // unchanged
        assertEq(token.getVotes(other), 500 ether);
        assertEq(token.getVotes(voter), 0);
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(voter);
        vm.expectRevert();
        token.mint(voter, 1 ether);
    }

    function test_UsesTimestampClock() public view {
        assertEq(token.CLOCK_MODE(), "mode=timestamp");
        assertEq(token.clock(), uint48(block.timestamp));
    }
}
