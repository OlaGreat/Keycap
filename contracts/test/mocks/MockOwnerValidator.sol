// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {IOwnerAuthValidator} from "../../src/interfaces/IOwnerAuthValidator.sol";

/// @dev Configurable stub so PasskeyAccount's orchestration logic (nonce handling,
///      replay protection, self-call gating, reentrancy guarding) can be tested
///      independently of real WebAuthn cryptography, which is already proven against
///      real captured fixtures in WebAuthnOwnerValidator.t.sol.
contract MockOwnerValidator is IOwnerAuthValidator {
    bool public shouldApprove;

    constructor(bool _shouldApprove) {
        shouldApprove = _shouldApprove;
    }

    function setShouldApprove(bool value) external {
        shouldApprove = value;
    }

    function verifyOwnerSignature(bytes32, WebAuthn.WebAuthnAuth calldata, uint256, uint256, bool)
        external
        view
        returns (bool)
    {
        return shouldApprove;
    }
}
