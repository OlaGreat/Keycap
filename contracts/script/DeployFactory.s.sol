// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {WebAuthnOwnerValidator} from "../src/validators/WebAuthnOwnerValidator.sol";
import {PasskeyAccountFactory} from "../src/PasskeyAccountFactory.sol";
import {PaidAPI} from "../src/mocks/PaidAPI.sol";

/// @notice Deploys the shared infrastructure: the owner signature validator, the
///         account factory, and the demo PaidAPI target. Individual accounts are
///         created later via PasskeyAccountFactory.createAccount(), not here.
contract DeployFactory is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 paidApiPrice = vm.envOr("PAID_API_PRICE_WEI", uint256(0.001 ether));

        vm.startBroadcast(deployerPk);

        WebAuthnOwnerValidator validator = new WebAuthnOwnerValidator();
        PasskeyAccountFactory factory = new PasskeyAccountFactory(validator);
        PaidAPI paidApi = new PaidAPI(paidApiPrice);

        vm.stopBroadcast();

        console2.log("WebAuthnOwnerValidator:", address(validator));
        console2.log("PasskeyAccountFactory:", address(factory));
        console2.log("PaidAPI:", address(paidApi));
    }
}
