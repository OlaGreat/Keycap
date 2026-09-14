// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {Call, CallHashLib} from "../../src/libraries/CallHashLib.sol";

contract CallHashLibTest is Test {
    Call call;

    function setUp() public {
        call = Call({target: address(0x1234), value: 1 ether, data: hex"deadbeef"});
    }

    function test_hashCall_IsDeterministic() public view {
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(this));
        bytes32 b = CallHashLib.hashCall(call, 0, 1, address(this));
        assertEq(a, b);
    }

    function test_hashCall_DiffersByNonce() public view {
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(this));
        bytes32 b = CallHashLib.hashCall(call, 1, 1, address(this));
        assertNotEq(a, b);
    }

    function test_hashCall_DiffersByChainId() public view {
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(this));
        bytes32 b = CallHashLib.hashCall(call, 0, 2, address(this));
        assertNotEq(a, b);
    }

    function test_hashCall_DiffersByAccountAddress() public view {
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(0xAAAA));
        bytes32 b = CallHashLib.hashCall(call, 0, 1, address(0xBBBB));
        assertNotEq(a, b);
    }

    function test_hashCall_DiffersByTarget() public view {
        Call memory other = Call({target: address(0x9999), value: call.value, data: call.data});
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(this));
        bytes32 b = CallHashLib.hashCall(other, 0, 1, address(this));
        assertNotEq(a, b);
    }

    function test_hashCall_DiffersByValue() public view {
        Call memory other = Call({target: call.target, value: 2 ether, data: call.data});
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(this));
        bytes32 b = CallHashLib.hashCall(other, 0, 1, address(this));
        assertNotEq(a, b);
    }

    function test_hashCall_DiffersByData() public view {
        Call memory other = Call({target: call.target, value: call.value, data: hex"cafebabe"});
        bytes32 a = CallHashLib.hashCall(call, 0, 1, address(this));
        bytes32 b = CallHashLib.hashCall(other, 0, 1, address(this));
        assertNotEq(a, b);
    }
}
