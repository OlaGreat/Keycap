// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @notice An append-only, auditable record of why an agent chose to make a given
///         call. Deliberately a separate, isolated contract from PasskeyAccount: it
///         holds no funds, enforces no policy, and touching it carries zero risk to
///         the already-tested account logic. Anyone can log a reasoning entry for
///         themselves — the trust value isn't restricting who can write, it's that a
///         logged reasoning is permanently attributed to its real caller and bound to
///         a specific call hash, so a reader can correlate "this spend happened" with
///         "here is what the agent was thinking when it decided to make it."
contract ReasoningLog {
    event ReasoningLogged(address indexed agent, bytes32 indexed callHash, string reasoning);

    function logReasoning(bytes32 callHash, string calldata reasoning) external {
        require(bytes(reasoning).length > 0, "ReasoningLog: empty reasoning");
        emit ReasoningLogged(msg.sender, callHash, reasoning);
    }
}
