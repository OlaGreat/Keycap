// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {Call} from "../../src/libraries/CallHashLib.sol";
import {Authorization, AuthType} from "../../src/interfaces/IPasskeyAccount.sol";
import {PasskeyAccount} from "../../src/PasskeyAccount.sol";
import {MockOwnerValidator} from "../mocks/MockOwnerValidator.sol";
import {MockTarget} from "../mocks/MockTarget.sol";

/// @dev Tests execute()'s orchestration logic (nonce handling, replay protection,
///      self-call admin gating, reentrancy guarding) against a MockOwnerValidator.
///      Real WebAuthn/P256 signature correctness is proven separately, against real
///      captured fixtures, in WebAuthnOwnerValidator.t.sol — a mock cannot exercise
///      that (it ignores the challenge hash entirely), so this suite deliberately
///      does not re-test cryptographic correctness, only that PasskeyAccount wires
///      the validator in correctly.
contract PasskeyAccountOwnerExecuteTest is Test {
    PasskeyAccount account;
    MockOwnerValidator validator;
    MockTarget target;

    uint256 constant OWNER_X = 1;
    uint256 constant OWNER_Y = 2;

    function setUp() public {
        validator = new MockOwnerValidator(true);
        account = new PasskeyAccount(OWNER_X, OWNER_Y, validator);
        target = new MockTarget();
    }

    function _dummySignature() internal pure returns (bytes memory) {
        WebAuthn.WebAuthnAuth memory auth;
        return abi.encode(auth);
    }

    function _ownerAuth(uint256 nonce) internal pure returns (Authorization memory) {
        return Authorization({authType: AuthType.OWNER_PASSKEY, nonce: nonce, signer: address(0), signature: _dummySignature()});
    }

    function test_execute_ValidOwnerSignature_Succeeds() public {
        Call memory call = Call({target: address(target), value: 0, data: abi.encodeCall(MockTarget.ping, (42))});

        account.execute(call, _ownerAuth(0));

        assertEq(target.callCount(), 1);
        assertEq(account.getOwnerNonce(), 1);
    }

    function test_execute_InvalidSignature_Reverts() public {
        validator.setShouldApprove(false);
        Call memory call = Call({target: address(target), value: 0, data: abi.encodeCall(MockTarget.ping, (42))});

        vm.expectRevert();
        account.execute(call, _ownerAuth(0));
    }

    function test_execute_WrongNonce_Reverts() public {
        Call memory call = Call({target: address(target), value: 0, data: abi.encodeCall(MockTarget.ping, (42))});

        vm.expectRevert();
        account.execute(call, _ownerAuth(5));
    }

    function test_execute_ReplayedNonce_Reverts() public {
        Call memory call = Call({target: address(target), value: 0, data: abi.encodeCall(MockTarget.ping, (42))});
        account.execute(call, _ownerAuth(0));

        vm.expectRevert();
        account.execute(call, _ownerAuth(0));
    }

    function test_execute_TargetCallReverts_PropagatesRevert() public {
        Call memory call = Call({target: address(target), value: 0, data: hex"deadbeef"});

        vm.expectRevert();
        account.execute(call, _ownerAuth(0));
    }

    function test_grantSessionKey_ViaExecute_Succeeds() public {
        address sessionKey = address(0x5E55104);
        address[] memory allowed = new address[](1);
        allowed[0] = address(target);
        Call memory call = Call({
            target: address(account),
            value: 0,
            data: abi.encodeCall(account.grantSessionKey, (sessionKey, allowed, 1 ether, uint64(block.timestamp + 1 days)))
        });

        account.execute(call, _ownerAuth(0));

        assertTrue(account.isTargetAllowed(sessionKey, address(target)));
    }

    function test_grantSessionKey_DirectCall_RevertsNotSelf() public {
        address[] memory allowed = new address[](0);
        vm.expectRevert();
        account.grantSessionKey(address(0x5E55104), allowed, 1 ether, uint64(block.timestamp + 1 days));
    }
}
