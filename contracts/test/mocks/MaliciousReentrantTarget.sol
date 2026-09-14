// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Call} from "../../src/libraries/CallHashLib.sol";
import {Authorization} from "../../src/interfaces/IPasskeyAccount.sol";
import {PasskeyAccount} from "../../src/PasskeyAccount.sol";

/// @dev Attempts to call back into `execute()` mid-call, to prove the ReentrancyGuard
///      (and checks-effects-interactions ordering of nonce/spend updates) actually
///      blocks it rather than merely happening to be safe by coincidence.
contract MaliciousReentrantTarget {
    PasskeyAccount private account;
    Call private reentrantCall;
    Authorization private reentrantAuth;

    function setReentryTarget(PasskeyAccount _account, Call calldata _call, Authorization calldata _auth) external {
        account = _account;
        reentrantCall = _call;
        reentrantAuth = _auth;
    }

    function trigger() external payable {
        account.execute(reentrantCall, reentrantAuth);
    }
}
