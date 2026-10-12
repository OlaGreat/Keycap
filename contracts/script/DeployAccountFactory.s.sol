// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {IOwnerAuthValidator} from "../src/interfaces/IOwnerAuthValidator.sol";
import {PasskeyAccountFactory} from "../src/PasskeyAccountFactory.sol";

/// @notice Deploys only a new PasskeyAccountFactory, reusing an already-deployed
///         owner validator. Accounts are not upgradeable, so shipping a change to
///         PasskeyAccount/SessionKeyManager means a new factory; the stateless
///         validator and the demo targets don't need redeploying.
contract DeployAccountFactory is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address validator = vm.envAddress("OWNER_VALIDATOR_ADDRESS");
        require(validator.code.length > 0, "DeployAccountFactory: validator has no code");

        vm.startBroadcast(deployerPk);
        PasskeyAccountFactory factory = new PasskeyAccountFactory(IOwnerAuthValidator(validator));
        vm.stopBroadcast();

        console2.log("PasskeyAccountFactory:", address(factory));
    }
}
