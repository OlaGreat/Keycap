// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IPasskeyAccountFactory {
    event AccountCreated(address indexed account, uint256 ownerPubKeyX, uint256 ownerPubKeyY, uint256 salt);

    /// @notice Deploys (or, if already deployed for this owner key + salt, returns
    ///         the existing) account address. Idempotent by design so a repeated
    ///         call — e.g. a frontend retry — never reverts.
    function createAccount(uint256 ownerPubKeyX, uint256 ownerPubKeyY, uint256 salt) external returns (address account);

    function getAddress(uint256 ownerPubKeyX, uint256 ownerPubKeyY, uint256 salt) external view returns (address predicted);
}
