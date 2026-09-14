// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Call} from "../libraries/CallHashLib.sol";

enum AuthType {
    OWNER_PASSKEY,
    SESSION_KEY
}

/// @notice Proves the right to execute `Call` under either the owner's passkey or a
///         granted session key.
/// @dev `signature` is `abi.encode(WebAuthn.WebAuthnAuth)` for OWNER_PASSKEY, or a
///      standard 65-byte ECDSA signature for SESSION_KEY. `signer` is ignored for
///      OWNER_PASSKEY (there is no address for a P256 owner) and must equal the
///      session key's own address for SESSION_KEY.
struct Authorization {
    AuthType authType;
    uint256 nonce;
    address signer;
    bytes signature;
}

interface IPasskeyAccount {
    event Executed(address indexed target, uint256 value, bytes data);

    function execute(Call calldata call, Authorization calldata auth) external returns (bytes memory result);

    /// @dev Per-signer nonce. For the owner path, query with `address(this)` — or use
    ///      `getOwnerNonce()` — since the owner has no address of its own.
    function getNonce(address signer) external view returns (uint256);
    function getOwnerNonce() external view returns (uint256);
    function owner() external view returns (uint256 pubKeyX, uint256 pubKeyY);

    /// @dev Only callable by the account itself — i.e. only reachable via `execute()`
    ///      with `call.target == address(this)`, so granting/revoking a session key
    ///      goes through the exact same owner-passkey verification as any other call,
    ///      with no separate admin auth path to keep in sync.
    function grantSessionKey(address sessionKey, address[] calldata allowedTargets, uint256 spendingLimit, uint64 validUntil)
        external;
    function revokeSessionKey(address sessionKey) external;
}
