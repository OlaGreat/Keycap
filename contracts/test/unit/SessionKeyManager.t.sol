// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {SessionKeyPermissions} from "../../src/session/SessionKeyManager.sol";
import {SessionKeyManagerHarness} from "../mocks/SessionKeyManagerHarness.sol";

contract SessionKeyManagerTest is Test {
    SessionKeyManagerHarness manager;
    address constant SESSION_KEY = address(0xAAAA);
    address constant TARGET = address(0xBBBB);
    address constant OTHER_TARGET = address(0xCCCC);

    function setUp() public {
        manager = new SessionKeyManagerHarness();
    }

    function _allowedTargets() internal pure returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = TARGET;
    }

    function test_grantSessionKey_StoresPermissions() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));

        SessionKeyPermissions memory info = manager.getSessionKeyInfo(SESSION_KEY);
        assertEq(info.spendingLimit, 1 ether);
        assertEq(info.spent, 0);
        assertEq(info.validUntil, block.timestamp + 1 days);
        assertFalse(info.revoked);
        assertTrue(info.granted);
    }

    function test_grantSessionKey_SetsAllowedTargets() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));

        assertTrue(manager.isTargetAllowed(SESSION_KEY, TARGET));
        assertFalse(manager.isTargetAllowed(SESSION_KEY, OTHER_TARGET));
    }

    function test_grantSessionKey_RevertsOnZeroAddress() public {
        vm.expectRevert();
        manager.grantSessionKey(address(0), _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));
    }

    function test_grantSessionKey_RevertsWhenValidUntilAlreadyPast() public {
        vm.warp(1000);
        vm.expectRevert();
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp - 1));
    }

    function test_revokeSessionKey_MarksRevoked() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));
        manager.revokeSessionKey(SESSION_KEY);

        assertTrue(manager.getSessionKeyInfo(SESSION_KEY).revoked);
    }

    function test_revokeSessionKey_RevertsWhenNeverGranted() public {
        vm.expectRevert();
        manager.revokeSessionKey(SESSION_KEY);
    }

    function test_consumeSpend_TracksCumulativeSpend() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));

        manager.consumeSessionKeySpend(SESSION_KEY, 0.3 ether);
        manager.consumeSessionKeySpend(SESSION_KEY, 0.4 ether);

        assertEq(manager.getSessionKeyInfo(SESSION_KEY).spent, 0.7 ether);
    }

    function test_consumeSpend_RevertsWhenExceedsLimit() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));
        manager.consumeSessionKeySpend(SESSION_KEY, 0.6 ether);

        vm.expectRevert();
        manager.consumeSessionKeySpend(SESSION_KEY, 0.5 ether);
    }

    function test_consumeSpend_RevertsWhenExpired() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));
        vm.warp(block.timestamp + 2 days);

        vm.expectRevert();
        manager.consumeSessionKeySpend(SESSION_KEY, 0.1 ether);
    }

    function test_consumeSpend_RevertsWhenRevoked() public {
        manager.grantSessionKey(SESSION_KEY, _allowedTargets(), 1 ether, uint64(block.timestamp + 1 days));
        manager.revokeSessionKey(SESSION_KEY);

        vm.expectRevert();
        manager.consumeSessionKeySpend(SESSION_KEY, 0.1 ether);
    }

    function test_consumeSpend_RevertsWhenNeverGranted() public {
        vm.expectRevert();
        manager.consumeSessionKeySpend(SESSION_KEY, 0.1 ether);
    }
}
