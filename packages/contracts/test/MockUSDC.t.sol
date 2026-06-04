// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal buyer = makeAddr("buyer");

    function setUp() public {
        usdc = new MockUSDC(address(this));
    }

    function test_SixDecimalsAndMetadata() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.symbol(), "mUSDC");
        assertEq(usdc.name(), "Mock USDC");
    }

    function test_OwnerMintsBudget() public {
        usdc.mint(buyer, 25_000_000); // 25 mUSDC (6 decimals)
        assertEq(usdc.balanceOf(buyer), 25_000_000);
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(buyer);
        vm.expectRevert();
        usdc.mint(buyer, 1_000_000);
    }
}
