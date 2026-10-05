// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {ReasoningLog} from "../src/ReasoningLog.sol";

/// @notice Deploys ReasoningLog standalone — kept separate from DeployFactory so
///         re-running it never touches the already-deployed, already-wired-up
///         PasskeyAccountFactory/PaidAPI addresses.
contract DeployReasoningLog is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);
        ReasoningLog reasoningLog = new ReasoningLog();
        vm.stopBroadcast();

        console2.log("ReasoningLog:", address(reasoningLog));
    }
}
