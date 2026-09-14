// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {IOwnerAuthValidator} from "../interfaces/IOwnerAuthValidator.sol";

/// @notice Thin adapter around the audited `webauthn-sol`/`p256-verifier` libraries.
///         Deliberately does no cryptography of its own — see WebAuthn.sol for the
///         verified correctness properties (challenge/type exact-slice matching,
///         low-s malleability guard, UP/UV flag checks, precompile-first at 0x0100
///         with a FreshCryptoLib fallback).
contract WebAuthnOwnerValidator is IOwnerAuthValidator {
    function verifyOwnerSignature(
        bytes32 challengeHash,
        WebAuthn.WebAuthnAuth calldata auth,
        uint256 ownerPubKeyX,
        uint256 ownerPubKeyY,
        bool requireUserVerification
    ) external view returns (bool) {
        return WebAuthn.verify(abi.encode(challengeHash), requireUserVerification, auth, ownerPubKeyX, ownerPubKeyY);
    }
}
