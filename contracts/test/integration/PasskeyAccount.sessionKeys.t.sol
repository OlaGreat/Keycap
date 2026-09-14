// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {Call, CallHashLib} from "../../src/libraries/CallHashLib.sol";
import {Authorization, AuthType} from "../../src/interfaces/IPasskeyAccount.sol";
import {PasskeyAccount} from "../../src/PasskeyAccount.sol";
import {MockOwnerValidator} from "../mocks/MockOwnerValidator.sol";
import {MockTarget} from "../mocks/MockTarget.sol";

contract PasskeyAccountSessionKeysTest is Test {
    PasskeyAccount account;
    MockOwnerValidator validator;
    MockTarget target;
    MockTarget otherTarget;

    uint256 sessionKeyPk;
    address sessionKey;

    function setUp() public {
        validator = new MockOwnerValidator(true);
        account = new PasskeyAccount(1, 2, validator);
        target = new MockTarget();
        otherTarget = new MockTarget();
        vm.deal(address(account), 10 ether);

        sessionKeyPk = 0xA11CE;
        sessionKey = vm.addr(sessionKeyPk);

        _grantSessionKey(sessionKey, address(target), 1 ether, uint64(block.timestamp + 1 days));
    }

    function _grantSessionKey(address key, address allowedTarget, uint256 limit, uint64 validUntil) internal {
        address[] memory allowed = new address[](1);
        allowed[0] = allowedTarget;
        WebAuthn.WebAuthnAuth memory dummy;
        Call memory grantCall = Call({
            target: address(account),
            value: 0,
            data: abi.encodeCall(account.grantSessionKey, (key, allowed, limit, validUntil))
        });
        account.execute(
            grantCall,
            Authorization({authType: AuthType.OWNER_PASSKEY, nonce: account.getOwnerNonce(), signer: address(0), signature: abi.encode(dummy)})
        );
    }

    function _sign(uint256 pk, Call memory call, uint256 nonce) internal view returns (bytes memory) {
        bytes32 callHash = CallHashLib.hashCall(call, nonce, block.chainid, address(account));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, callHash);
        return abi.encodePacked(r, s, v);
    }

    function _sessionAuth(address key, uint256 pk, Call memory call, uint256 nonce) internal view returns (Authorization memory) {
        return Authorization({authType: AuthType.SESSION_KEY, nonce: nonce, signer: key, signature: _sign(pk, call, nonce)});
    }

    function test_execute_ValidSessionKey_AllowedTarget_Succeeds() public {
        Call memory call = Call({target: address(target), value: 0.1 ether, data: abi.encodeCall(MockTarget.ping, (7))});

        account.execute(call, _sessionAuth(sessionKey, sessionKeyPk, call, 0));

        assertEq(target.callCount(), 1);
        assertEq(account.getNonce(sessionKey), 1);
    }

    function test_execute_SessionKey_DisallowedTarget_Reverts() public {
        Call memory call = Call({target: address(otherTarget), value: 0, data: abi.encodeCall(MockTarget.ping, (7))});

        vm.expectRevert();
        account.execute(call, _sessionAuth(sessionKey, sessionKeyPk, call, 0));
    }

    function test_execute_SessionKey_ExceedsSpendLimit_Reverts() public {
        Call memory call = Call({target: address(target), value: 1.5 ether, data: abi.encodeCall(MockTarget.ping, (7))});

        vm.expectRevert();
        account.execute(call, _sessionAuth(sessionKey, sessionKeyPk, call, 0));
    }

    function test_execute_SessionKey_AfterExpiry_Reverts() public {
        Call memory call = Call({target: address(target), value: 0.1 ether, data: abi.encodeCall(MockTarget.ping, (7))});
        vm.warp(block.timestamp + 2 days);

        vm.expectRevert();
        account.execute(call, _sessionAuth(sessionKey, sessionKeyPk, call, 0));
    }

    function test_execute_RevokedSessionKey_Reverts() public {
        WebAuthn.WebAuthnAuth memory dummy;
        Call memory revokeCall =
            Call({target: address(account), value: 0, data: abi.encodeCall(account.revokeSessionKey, (sessionKey))});
        account.execute(
            revokeCall,
            Authorization({authType: AuthType.OWNER_PASSKEY, nonce: account.getOwnerNonce(), signer: address(0), signature: abi.encode(dummy)})
        );

        Call memory call = Call({target: address(target), value: 0.1 ether, data: abi.encodeCall(MockTarget.ping, (7))});
        vm.expectRevert();
        account.execute(call, _sessionAuth(sessionKey, sessionKeyPk, call, 0));
    }

    function test_execute_SessionKey_CumulativeSpendAcrossCalls_TracksCorrectly() public {
        Call memory call1 = Call({target: address(target), value: 0.4 ether, data: abi.encodeCall(MockTarget.ping, (1))});
        account.execute(call1, _sessionAuth(sessionKey, sessionKeyPk, call1, 0));

        Call memory call2 = Call({target: address(target), value: 0.4 ether, data: abi.encodeCall(MockTarget.ping, (2))});
        account.execute(call2, _sessionAuth(sessionKey, sessionKeyPk, call2, 1));

        Call memory call3 = Call({target: address(target), value: 0.4 ether, data: abi.encodeCall(MockTarget.ping, (3))});
        vm.expectRevert();
        account.execute(call3, _sessionAuth(sessionKey, sessionKeyPk, call3, 2));
    }

    function test_execute_SessionKey_WrongSigner_Reverts() public {
        uint256 otherPk = 0xB0B;
        Call memory call = Call({target: address(target), value: 0.1 ether, data: abi.encodeCall(MockTarget.ping, (7))});
        // Sign with a different key than the one claimed as `signer`.
        Authorization memory auth = _sessionAuth(sessionKey, otherPk, call, 0);

        vm.expectRevert();
        account.execute(call, auth);
    }
}
