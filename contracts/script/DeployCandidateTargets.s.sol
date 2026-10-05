// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {PaidAPI} from "../src/mocks/PaidAPI.sol";

/// @notice Deploys two more PaidAPI instances at different price points, alongside
///         the original one from DeployFactory, so the agent has several real
///         competing paid targets to prioritize between instead of a single
///         yes/no gate. Reuses the already-tested PaidAPI contract as-is — only
///         the constructor price differs, so no new Solidity risk is introduced.
contract DeployCandidateTargets is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);
        PaidAPI newsApi = new PaidAPI(0.01 ether);
        PaidAPI marketDataApi = new PaidAPI(0.03 ether);
        vm.stopBroadcast();

        console2.log("NewsApi (0.01 MON/call):", address(newsApi));
        console2.log("MarketDataApi (0.03 MON/call):", address(marketDataApi));
    }
}
