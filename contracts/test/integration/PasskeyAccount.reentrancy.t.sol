// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {Call, CallHashLib} from "../../src/libraries/CallHashLib.sol";
import {Authorization, AuthType} from "../../src/interfaces/IPasskeyAccount.sol";
import {PasskeyAccount} from "../../src/PasskeyAccount.sol";
import {MockOwnerValidator} from "../mocks/MockOwnerValidator.sol";
import {MaliciousReentrantTarget} from "../mocks/MaliciousReentrantTarget.sol";

contract PasskeyAccountReentrancyTest is Test {
    PasskeyAccount account;
    MockOwnerValidator validator;
    MaliciousReentrantTarget attacker;

    function setUp() public {
        validator = new MockOwnerValidator(true);
        account = new PasskeyAccount(1, 2, validator);
        attacker = new MaliciousReentrantTarget();
        vm.deal(address(account), 10 ether);
    }

    function _ownerAuth(uint256 nonce) internal pure returns (Authorization memory) {
        WebAuthn.WebAuthnAuth memory dummy;
        return Authorization({authType: AuthType.OWNER_PASSKEY, nonce: nonce, signer: address(0), signature: abi.encode(dummy)});
    }

    function test_execute_ReentrantCall_Reverts() public {
        // The outer call (owner-authorized) targets the attacker's `trigger()`, which
        // itself tries to call back into `execute()` (as a second, independently
        // owner-authorized call) before the outer call returns.
        Call memory innerCall = Call({target: address(attacker), value: 0, data: ""});
        attacker.setReentryTarget(account, innerCall, _ownerAuth(1));

        Call memory outerCall = Call({target: address(attacker), value: 0, data: abi.encodeCall(MaliciousReentrantTarget.trigger, ())});

        vm.expectRevert();
        account.execute(outerCall, _ownerAuth(0));
    }
}
