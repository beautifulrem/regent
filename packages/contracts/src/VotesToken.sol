// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title VotesToken
/// @notice ERC20Votes governance token on a TIMESTAMP clock, so the Governor's
///         votingDelay/votingPeriod are denominated in seconds (demo-friendly).
///         HACKATHON DEMO — NO REAL VALUE.
contract VotesToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    constructor(address initialOwner)
        ERC20("Mandate Votes", "MVOTE")
        ERC20Permit("Mandate Votes")
        Ownable(initialOwner)
    {}

    /// @notice Seed voting power. Owner-only; call BEFORE a proposal snapshot.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // --- IERC6372 timestamp clock ---------------------------------------------

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // --- required multiple-inheritance overrides ------------------------------

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
