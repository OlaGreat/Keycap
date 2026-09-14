// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {PasskeyAccount} from "../../src/PasskeyAccount.sol";
import {PasskeyAccountFactory} from "../../src/PasskeyAccountFactory.sol";
import {MockOwnerValidator} from "../mocks/MockOwnerValidator.sol";

contract PasskeyAccountFactoryTest is Test {
    PasskeyAccountFactory factory;
    MockOwnerValidator validator;

    function setUp() public {
        validator = new MockOwnerValidator(true);
        factory = new PasskeyAccountFactory(validator);
    }

    function test_getAddress_MatchesCreateAccount() public {
        address predicted = factory.getAddress(11, 22, 0);
        address actual = factory.createAccount(11, 22, 0);
        assertEq(predicted, actual);
    }

    function test_createAccount_CalledTwiceWithSameParams_ReturnsSameAddress() public {
        address first = factory.createAccount(11, 22, 0);
        address second = factory.createAccount(11, 22, 0);
        assertEq(first, second);
    }

    function test_createAccount_DifferentSalt_DifferentAddress() public {
        address a = factory.createAccount(11, 22, 0);
        address b = factory.createAccount(11, 22, 1);
        assertTrue(a != b);
    }

    function test_createAccount_DifferentOwnerKey_DifferentAddress() public {
        address a = factory.createAccount(11, 22, 0);
        address b = factory.createAccount(33, 44, 0);
        assertTrue(a != b);
    }

    function test_createdAccount_HasCorrectOwner() public {
        address account = factory.createAccount(11, 22, 0);
        (uint256 x, uint256 y) = PasskeyAccount(payable(account)).owner();
        assertEq(x, 11);
        assertEq(y, 22);
    }

    function test_createdAccount_UsesFactoryOwnerValidator() public {
        address account = factory.createAccount(11, 22, 0);
        assertEq(address(PasskeyAccount(payable(account)).ownerValidator()), address(validator));
    }
}
