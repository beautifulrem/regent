// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploy ONLY the x402 payment token (mUSDC) and fund the voter's smart account, leaving the
///         existing VotesToken/Governor/proposal untouched. The broadcast is the user's step.
///
///   VOTER_ADDRESS=0x<userDemoSA> forge script script/DeployMockUSDC.s.sol \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --broadcast
contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC payment) {
        address voter = vm.envAddress("VOTER_ADDRESS");
        uint256 budget = vm.envOr("SEED_MUSDC", uint256(1000e6)); // 1000 mUSDC (6 decimals)

        vm.startBroadcast(msg.sender);
        payment = new MockUSDC(msg.sender); // deployer is owner
        payment.mint(voter, budget);
        vm.stopBroadcast();

        console2.log("MockUSDC    :", address(payment));
        console2.log("voter       :", voter);
        console2.log("voter mUSDC :", payment.balanceOf(voter));
        require(payment.balanceOf(voter) == budget, "voter mUSDC not funded");
    }
}
