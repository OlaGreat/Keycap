// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @notice Per-session-key permissions: a cumulative native-value spend cap, an
///         expiry, and revocation state. Target allowlisting is tracked separately
///         (see `isTargetAllowed`) for O(1) lookup instead of scanning an array.
struct SessionKeyPermissions {
    uint128 spendingLimit;
    uint128 spent;
    uint64 validUntil;
    bool revoked;
    bool granted;
}

/// @notice Read-only view surface for session key policy — split from the mutating
///         admin functions (which are internal-only; see SessionKeyManager) so a
///         frontend or indexer only needs to depend on what it actually reads.
interface ISessionKeyManager {
    event SessionKeyGranted(address indexed sessionKey, uint256 spendingLimit, uint64 validUntil);
    event SessionKeyRevoked(address indexed sessionKey);
    event SessionKeySpent(address indexed sessionKey, uint256 amount, uint256 remaining);

    function isTargetAllowed(address sessionKey, address target) external view returns (bool);
    function getSessionKeyInfo(address sessionKey) external view returns (SessionKeyPermissions memory);
}
