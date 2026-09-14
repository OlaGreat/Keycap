// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {WebAuthn} from "webauthn-sol/WebAuthn.sol";

/// @notice Verifies that a WebAuthn assertion was produced by the account owner's
///         passkey over a given challenge hash.
interface IOwnerAuthValidator {
    function verifyOwnerSignature(
        bytes32 challengeHash,
        WebAuthn.WebAuthnAuth calldata auth,
        uint256 ownerPubKeyX,
        uint256 ownerPubKeyY,
        bool requireUserVerification
    ) external view returns (bool);
}
