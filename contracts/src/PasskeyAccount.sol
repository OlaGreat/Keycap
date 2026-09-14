// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {WebAuthn} from "webauthn-sol/WebAuthn.sol";

import {Call, CallHashLib} from "./libraries/CallHashLib.sol";
import {IOwnerAuthValidator} from "./interfaces/IOwnerAuthValidator.sol";
import {IPasskeyAccount, Authorization, AuthType} from "./interfaces/IPasskeyAccount.sol";
import {SessionKeyManager} from "./session/SessionKeyManager.sol";

/// @notice A smart contract account whose root of trust is a device passkey
///         (P256/WebAuthn, verified via Monad's native 0x0100 precompile), with
///         scoped, revocable session keys layered on top for AI agents.
/// @dev Deliberately not ERC-4337: `execute()` is called directly by whoever submits
///      it (paying their own gas), authorized entirely by the embedded signature —
///      no UserOp/EntryPoint/bundler dependency, which keeps every test a direct
///      call. No upgradeability, by design — see project plan for the trade-off
///      rationale. Deployed via CREATE2 directly (not a minimal-proxy clone), since
///      each account's owner public key must be its own immutable storage, not
///      bytecode shared across a proxy implementation.
contract PasskeyAccount is IPasskeyAccount, SessionKeyManager, ReentrancyGuard {
    uint256 public immutable ownerPubKeyX;
    uint256 public immutable ownerPubKeyY;
    IOwnerAuthValidator public immutable ownerValidator;

    mapping(address signer => uint256 nonce) private _nonces;

    constructor(uint256 _ownerPubKeyX, uint256 _ownerPubKeyY, IOwnerAuthValidator _ownerValidator) {
        require(_ownerPubKeyX != 0 || _ownerPubKeyY != 0, "PasskeyAccount: zero owner key");
        require(address(_ownerValidator) != address(0), "PasskeyAccount: zero validator");
        ownerPubKeyX = _ownerPubKeyX;
        ownerPubKeyY = _ownerPubKeyY;
        ownerValidator = _ownerValidator;
    }

    receive() external payable {}

    function owner() external view returns (uint256, uint256) {
        return (ownerPubKeyX, ownerPubKeyY);
    }

    function getNonce(address signer) public view returns (uint256) {
        return _nonces[signer];
    }

    function getOwnerNonce() public view returns (uint256) {
        return _nonces[address(this)];
    }

    function execute(Call calldata call, Authorization calldata auth) external nonReentrant returns (bytes memory result) {
        address nonceKey = auth.authType == AuthType.OWNER_PASSKEY ? address(this) : auth.signer;
        require(auth.nonce == _nonces[nonceKey], "PasskeyAccount: bad nonce");

        bytes32 callHash = CallHashLib.hashCall(call, auth.nonce, block.chainid, address(this));

        if (auth.authType == AuthType.OWNER_PASSKEY) {
            WebAuthn.WebAuthnAuth memory webAuthnAuth = abi.decode(auth.signature, (WebAuthn.WebAuthnAuth));
            require(
                ownerValidator.verifyOwnerSignature(callHash, webAuthnAuth, ownerPubKeyX, ownerPubKeyY, true),
                "PasskeyAccount: bad owner signature"
            );
        } else {
            require(isTargetAllowed(auth.signer, call.target), "PasskeyAccount: target not allowed");
            address recovered = ECDSA.recover(callHash, auth.signature);
            require(recovered == auth.signer, "PasskeyAccount: bad session signature");
            _consumeSessionKeySpend(auth.signer, call.value);
        }

        // Effects before interaction: nonce/spend state is committed before the
        // external call so a reentrant call sees consistent, already-updated state.
        _nonces[nonceKey] = auth.nonce + 1;

        (bool ok, bytes memory ret) = call.target.call{value: call.value}(call.data);
        require(ok, "PasskeyAccount: call reverted");

        emit Executed(call.target, call.value, call.data);
        return ret;
    }

    function grantSessionKey(address sessionKey, address[] calldata allowedTargets, uint256 spendingLimit, uint64 validUntil)
        external
    {
        require(msg.sender == address(this), "PasskeyAccount: only self");
        require(sessionKey != address(this), "PasskeyAccount: session key cannot be self");
        _grantSessionKey(sessionKey, allowedTargets, spendingLimit, validUntil);
    }

    function revokeSessionKey(address sessionKey) external {
        require(msg.sender == address(this), "PasskeyAccount: only self");
        _revokeSessionKey(sessionKey);
    }
}
