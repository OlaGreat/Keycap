// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {ReasoningLog} from "../../src/ReasoningLog.sol";

contract ReasoningLogTest is Test {
    ReasoningLog reasoningLog;

    function setUp() public {
        reasoningLog = new ReasoningLog();
    }

    function test_logReasoning_EmitsEventWithCallerAsAgent() public {
        bytes32 callHash = keccak256("some call");
        vm.expectEmit(true, true, false, true, address(reasoningLog));
        emit ReasoningLog.ReasoningLogged(address(this), callHash, "worth the spend");
        reasoningLog.logReasoning(callHash, "worth the spend");
    }

    function test_logReasoning_DifferentCallersLogIndependently() public {
        bytes32 callHash = keccak256("some call");
        address other = address(0xBEEF);

        reasoningLog.logReasoning(callHash, "reason A");

        vm.prank(other);
        vm.expectEmit(true, true, false, true, address(reasoningLog));
        emit ReasoningLog.ReasoningLogged(other, callHash, "reason B");
        reasoningLog.logReasoning(callHash, "reason B");
    }

    function test_logReasoning_RevertsOnEmptyReasoning() public {
        vm.expectRevert();
        reasoningLog.logReasoning(keccak256("x"), "");
    }
}
