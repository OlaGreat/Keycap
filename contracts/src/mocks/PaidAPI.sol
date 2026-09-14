// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @notice Demo target: a mock metered API charging native MON per call. Represents
///         what an agent's session key spends against in the live demo — the
///         account's spend cap is native-value based (see project plan for why this
///         scenario was chosen over an ERC-20 one).
contract PaidAPI {
    uint256 public immutable pricePerCall;
    mapping(address caller => uint256 count) public callsServed;

    event Served(address indexed caller, uint256 paid);

    constructor(uint256 _pricePerCall) {
        pricePerCall = _pricePerCall;
    }

    function callApi() external payable returns (string memory) {
        require(msg.value >= pricePerCall, "PaidAPI: insufficient payment");
        callsServed[msg.sender]++;
        emit Served(msg.sender, msg.value);
        return "ok";
    }
}
