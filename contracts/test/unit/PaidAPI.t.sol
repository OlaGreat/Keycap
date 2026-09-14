// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {PaidAPI} from "../../src/mocks/PaidAPI.sol";

contract PaidAPITest is Test {
    PaidAPI api;
    uint256 constant PRICE = 0.01 ether;

    function setUp() public {
        api = new PaidAPI(PRICE);
    }

    function test_callApi_RevertsIfUnderpaid() public {
        vm.expectRevert();
        api.callApi{value: PRICE - 1}();
    }

    function test_callApi_SucceedsAtExactPrice() public {
        api.callApi{value: PRICE}();
        assertEq(api.callsServed(address(this)), 1);
    }

    function test_callApi_AcceptsOverpayment() public {
        api.callApi{value: PRICE * 2}();
        assertEq(api.callsServed(address(this)), 1);
    }

    function test_callApi_TracksPerCallerCallCount() public {
        api.callApi{value: PRICE}();
        api.callApi{value: PRICE}();
        assertEq(api.callsServed(address(this)), 2);
    }

    function test_callApi_EmitsServedEvent() public {
        vm.expectEmit(true, false, false, true, address(api));
        emit PaidAPI.Served(address(this), PRICE);
        api.callApi{value: PRICE}();
    }
}
