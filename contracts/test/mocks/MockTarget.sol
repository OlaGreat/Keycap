// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @dev A trivial external contract for `execute()` to call into during tests.
contract MockTarget {
    uint256 public lastValueReceived;
    bytes public lastData;
    uint256 public callCount;

    function ping(uint256 value) external payable returns (uint256) {
        lastValueReceived = msg.value;
        lastData = msg.data;
        callCount++;
        return value;
    }
}
