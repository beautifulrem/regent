// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// Minimal spike target: same selector as an OpenZeppelin Governor's castVote.
/// Isolates the delegation mechanics (the go/no-go) from real proposal-lifecycle noise.
/// Deploy on Base Sepolia; put its address in spike/.env as GOVERNOR_ADDRESS.
contract MockGovernor {
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support);
    // proposalId => support => count (so a real vote is observable on-chain)
    mapping(uint256 => mapping(uint8 => uint256)) public tally;

    function castVote(uint256 proposalId, uint8 support) external returns (uint256) {
        require(support <= 2, "invalid support");
        tally[proposalId][support] += 1;
        emit VoteCast(msg.sender, proposalId, support);
        return tally[proposalId][support];
    }
}
