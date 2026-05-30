// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from
    "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from
    "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title MandateGovernor
/// @notice Minimal OZ Governor for the Mandate demo. Clock follows the token (timestamp),
///         so votingDelay=60s / votingPeriod=300s; proposalThreshold=0 (anyone may propose).
///         The name is constructor-set so the mainnet instance can carry the
///         "HACKATHON DEMO — NO REAL VALUE / 0 TREASURY" disclaimer.
contract MandateGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction
{
    constructor(IVotes token, string memory name_)
        Governor(name_)
        GovernorSettings(60 /* votingDelay (s) */, 300 /* votingPeriod (s) */, 0 /* proposalThreshold */)
        GovernorVotes(token)
        GovernorVotesQuorumFraction(4)
    {}

    // --- required multiple-inheritance overrides ------------------------------

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function quorum(uint256 timepoint)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(timepoint);
    }
}
