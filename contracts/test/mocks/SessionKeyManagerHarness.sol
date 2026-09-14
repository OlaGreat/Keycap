// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {SessionKeyManager} from "../../src/session/SessionKeyManager.sol";

/// @dev Exposes SessionKeyManager's internal mutators for direct unit testing.
///      No access control here — that belongs to whatever authorizes admin actions
///      in the real deployment (PasskeyAccount, via passkey signature verification).
contract SessionKeyManagerHarness is SessionKeyManager {
    function grantSessionKey(address sessionKey, address[] calldata allowedTargets, uint256 spendingLimit, uint64 validUntil)
        external
    {
        _grantSessionKey(sessionKey, allowedTargets, spendingLimit, validUntil);
    }

    function revokeSessionKey(address sessionKey) external {
        _revokeSessionKey(sessionKey);
    }

    function consumeSessionKeySpend(address sessionKey, uint256 amount) external {
        _consumeSessionKeySpend(sessionKey, amount);
    }
}
