// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @notice A single call an account is authorized to perform.
struct Call {
    address target;
    uint256 value;
    bytes data;
}

/// @notice Hashes a `Call` bound to a signer's nonce, the current chain, and the
///         account address itself, so a signature over the result cannot be replayed
///         against a different nonce, a different chain, or a different account
///         deployed with the same owner key.
library CallHashLib {
    function hashCall(Call memory call, uint256 nonce, uint256 chainId, address account)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(call.target, call.value, keccak256(call.data), nonce, chainId, account));
    }
}
