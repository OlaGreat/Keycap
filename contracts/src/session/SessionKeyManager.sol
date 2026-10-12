// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {ISessionKeyManager, SessionKeyPermissions} from "../interfaces/ISessionKeyManager.sol";

/// @notice Pure policy/storage module for scoped agent session keys: cumulative
///         native-value spend cap, target allowlist, expiry, revocation.
/// @dev Deliberately holds no access control of its own — the account's owner is a
///      P256/WebAuthn passkey, not an address, so "only the owner may grant/revoke"
///      cannot be a `msg.sender` check here. That authorization happens one level up
///      (PasskeyAccount verifies the owner's passkey signature before calling into
///      these internal mutators), keeping this module's single responsibility to
///      policy math only.
abstract contract SessionKeyManager is ISessionKeyManager {
    mapping(address sessionKey => SessionKeyPermissions) private _sessionKeys;
    mapping(address sessionKey => mapping(address target => bool)) private _allowedTargets;
    // Mappings can't be iterated, so each key's current target list is kept
    // alongside the allowlist — a re-grant needs it to clear targets that the
    // new grant drops, otherwise narrowing permissions would silently fail.
    mapping(address sessionKey => address[] targets) private _targetLists;

    function isTargetAllowed(address sessionKey, address target) public view returns (bool) {
        return _allowedTargets[sessionKey][target];
    }

    function getSessionKeyInfo(address sessionKey) public view returns (SessionKeyPermissions memory) {
        return _sessionKeys[sessionKey];
    }

    function _grantSessionKey(address sessionKey, address[] memory allowedTargets, uint256 spendingLimit, uint64 validUntil)
        internal
    {
        require(sessionKey != address(0), "SessionKeyManager: zero session key");
        require(validUntil > block.timestamp, "SessionKeyManager: already expired");
        require(spendingLimit <= type(uint128).max, "SessionKeyManager: spending limit overflow");

        // Safe: bounded by the require(spendingLimit <= type(uint128).max) above.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 boundedSpendingLimit = uint128(spendingLimit);
        _sessionKeys[sessionKey] = SessionKeyPermissions({
            spendingLimit: boundedSpendingLimit,
            spent: 0,
            validUntil: validUntil,
            revoked: false,
            granted: true
        });

        address[] storage previous = _targetLists[sessionKey];
        for (uint256 i = 0; i < previous.length; i++) {
            _allowedTargets[sessionKey][previous[i]] = false;
        }
        delete _targetLists[sessionKey];

        for (uint256 i = 0; i < allowedTargets.length; i++) {
            // The account's admin functions (grant/revoke) are gated only by
            // msg.sender == address(this), which an allowlisted self-call would
            // satisfy — letting a session key re-grant itself any cap.
            require(allowedTargets[i] != address(this), "SessionKeyManager: self target");
            _allowedTargets[sessionKey][allowedTargets[i]] = true;
            _targetLists[sessionKey].push(allowedTargets[i]);
        }

        emit SessionKeyGranted(sessionKey, spendingLimit, validUntil);
    }

    function _revokeSessionKey(address sessionKey) internal {
        require(_sessionKeys[sessionKey].granted, "SessionKeyManager: not granted");
        _sessionKeys[sessionKey].revoked = true;
        emit SessionKeyRevoked(sessionKey);
    }

    function _consumeSessionKeySpend(address sessionKey, uint256 amount) internal {
        SessionKeyPermissions storage perm = _sessionKeys[sessionKey];
        require(perm.granted, "SessionKeyManager: not granted");
        require(!perm.revoked, "SessionKeyManager: revoked");
        require(block.timestamp <= perm.validUntil, "SessionKeyManager: expired");

        uint256 newSpent = uint256(perm.spent) + amount;
        require(newSpent <= perm.spendingLimit, "SessionKeyManager: exceeds spending limit");

        // Safe: bounded by the require(newSpent <= perm.spendingLimit) above, and
        // spendingLimit is itself a uint128.
        // forge-lint: disable-next-line(unsafe-typecast)
        perm.spent = uint128(newSpent);
        emit SessionKeySpent(sessionKey, amount, perm.spendingLimit - perm.spent);
    }
}
