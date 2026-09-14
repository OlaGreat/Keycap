// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {Base64Url} from "FreshCryptoLib/utils/Base64Url.sol";
import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {IOwnerAuthValidator} from "../../src/interfaces/IOwnerAuthValidator.sol";
import {WebAuthnOwnerValidator} from "../../src/validators/WebAuthnOwnerValidator.sol";

/// @dev Fixture reused verbatim from lib/webauthn-sol/test/WebAuthn.t.sol::test_safari
///      (a real captured Safari WebAuthn assertion from the audited upstream test
///      suite), not hand-crafted, so a passing test proves real signature verification.
contract WebAuthnOwnerValidatorTest is Test {
    IOwnerAuthValidator validator;

    bytes32 constant CHALLENGE = bytes32(0xf631058a3ba1116acce12396fad0a125b5041c43f8e15723709f81aa8d5f4ccf);
    uint256 constant PUB_X = 28573233055232466711029625910063034642429572463461595413086259353299906450061;
    uint256 constant PUB_Y = 39367742072897599771788408398752356480431855827262528811857788332151452825281;
    uint256 constant P256_N = 115792089210356248762697446949407573529996955224135760342422259061068512044369;

    function setUp() public {
        validator = new WebAuthnOwnerValidator();
    }

    function _safariAuth() internal pure returns (WebAuthn.WebAuthnAuth memory) {
        return WebAuthn.WebAuthnAuth({
            authenticatorData: hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000101",
            clientDataJSON: string.concat(
                '{"type":"webauthn.get","challenge":"',
                Base64Url.encode(abi.encode(CHALLENGE)),
                '","origin":"http://localhost:3005"}'
            ),
            challengeIndex: 23,
            typeIndex: 1,
            r: 43684192885701841787131392247364253107519555363555461570655060745499568693242,
            s: 22655632649588629308599201066602670461698485748654492451178007896016452673579
        });
    }

    function test_verify_ValidOwnerAssertion_ReturnsTrue() public view {
        assertTrue(validator.verifyOwnerSignature(CHALLENGE, _safariAuth(), PUB_X, PUB_Y, false));
    }

    function test_verify_WrongChallenge_ReturnsFalse() public view {
        bytes32 wrongChallenge = keccak256("not the challenge that was signed");
        assertFalse(validator.verifyOwnerSignature(wrongChallenge, _safariAuth(), PUB_X, PUB_Y, false));
    }

    function test_verify_WrongPublicKey_ReturnsFalse() public view {
        assertFalse(validator.verifyOwnerSignature(CHALLENGE, _safariAuth(), PUB_X, PUB_Y + 1, false));
    }

    function test_verify_HighS_ReturnsFalse() public view {
        WebAuthn.WebAuthnAuth memory auth = _safariAuth();
        // Flip s to its n-s counterpart, which must sit above n/2 and be rejected
        // by the malleability guard regardless of curve-math validity.
        auth.s = P256_N - auth.s;
        assertFalse(validator.verifyOwnerSignature(CHALLENGE, auth, PUB_X, PUB_Y, false));
    }

    function test_verify_ValidOwnerAssertion_WithUserVerificationRequired_ReturnsTrue() public view {
        // The Safari fixture's flags byte is 0x05 (UP | UV both set), so requiring UV
        // must still succeed against the unmodified fixture.
        assertTrue(validator.verifyOwnerSignature(CHALLENGE, _safariAuth(), PUB_X, PUB_Y, true));
    }

    function test_verify_UserVerificationRequiredButMissing_ReturnsFalse() public view {
        WebAuthn.WebAuthnAuth memory auth = _safariAuth();
        // Flip the fixture's flags byte from 0x05 (UP|UV) to 0x01 (UP only). The UP/UV
        // gate is checked before signature verification is even attempted, so this
        // isolates the UV-enforcement branch specifically rather than merely producing
        // an unrelated signature mismatch.
        auth.authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630100000101";
        assertFalse(validator.verifyOwnerSignature(CHALLENGE, auth, PUB_X, PUB_Y, true));
    }
}
