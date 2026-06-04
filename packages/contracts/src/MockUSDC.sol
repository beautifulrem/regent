// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice A 6-decimal mock USDC for the x402 pay-per-query rail — the AI's spending money,
///         kept SEPARATE from MVOTE voting power. Owner-mint only (testnet faucet stand-in).
///         HACKATHON DEMO — NO REAL VALUE.
contract MockUSDC is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Mock USDC", "mUSDC") Ownable(initialOwner) {}

    /// @notice Real USDC is 6 decimals; mirror it so the toll math matches mainnet.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Fund a buyer's x402 budget. Owner-only.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
