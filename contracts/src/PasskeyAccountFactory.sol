// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IOwnerAuthValidator} from "./interfaces/IOwnerAuthValidator.sol";
import {IPasskeyAccountFactory} from "./interfaces/IPasskeyAccountFactory.sol";
import {PasskeyAccount} from "./PasskeyAccount.sol";

/// @notice Deploys `PasskeyAccount`s deterministically via CREATE2, keyed by the
///         owner's public key and an arbitrary salt (so one passkey can own multiple
///         accounts). Deploys full contract instances, not minimal-proxy clones — see
///         PasskeyAccount's own docs for why (owner key must be immutable storage,
///         not bytecode shared across a proxy implementation).
contract PasskeyAccountFactory is IPasskeyAccountFactory {
    IOwnerAuthValidator public immutable ownerValidator;

    constructor(IOwnerAuthValidator _ownerValidator) {
        require(address(_ownerValidator) != address(0), "PasskeyAccountFactory: zero validator");
        ownerValidator = _ownerValidator;
    }

    function createAccount(uint256 ownerPubKeyX, uint256 ownerPubKeyY, uint256 salt) external returns (address account) {
        address predicted = getAddress(ownerPubKeyX, ownerPubKeyY, salt);
        if (predicted.code.length > 0) {
            return predicted;
        }

        account = address(
            new PasskeyAccount{salt: _saltHash(ownerPubKeyX, ownerPubKeyY, salt)}(ownerPubKeyX, ownerPubKeyY, ownerValidator)
        );
        emit AccountCreated(account, ownerPubKeyX, ownerPubKeyY, salt);
    }

    function getAddress(uint256 ownerPubKeyX, uint256 ownerPubKeyY, uint256 salt) public view returns (address predicted) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(PasskeyAccount).creationCode, abi.encode(ownerPubKeyX, ownerPubKeyY, ownerValidator))
        );
        predicted = Create2.computeAddress(_saltHash(ownerPubKeyX, ownerPubKeyY, salt), initCodeHash);
    }

    function _saltHash(uint256 ownerPubKeyX, uint256 ownerPubKeyY, uint256 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(ownerPubKeyX, ownerPubKeyY, salt));
    }
}
