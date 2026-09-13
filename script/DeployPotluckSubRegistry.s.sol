// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PotluckSubRegistry} from "../src/naming/PotluckSubRegistry.sol";

/// @title DeployPotluckSubRegistry
/// @notice Recovery helper: deploy ONLY the potluck-node PotluckSubRegistry, controlled by an
///         already-deployed PotluckENS. Used when the Phase 2 batch (DeployPotluckEns) broadcast
///         only partially landed — e.g. an EIP-7702 delegated payer account got throttled
///         ("in-flight transaction limit reached") and the 3rd deploy never mined. PotluckENS and
///         ReputationResolver survive from the partial run; only the subregistry is missing.
///
///         Deploys a single tx, so it sidesteps the gapped-nonce throttle entirely.
///
///         Env required:
///           PRIVATE_KEY   MEMBER1 (the PotluckENS controller/owner)
///           POTLUCK_ENS   the already-live PotluckENS address from the partial Phase 2 run
contract DeployPotluckSubRegistry is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address ens = vm.envAddress("POTLUCK_ENS");

        vm.startBroadcast(pk);
        PotluckSubRegistry potluckReg = new PotluckSubRegistry(ens);
        vm.stopBroadcast();

        console2.log("== PotluckSubRegistry deployed ==");
        console2.log("PotluckSubRegistry :", address(potluckReg));
        console2.log("controller (ENS)   :", ens);
        console2.log(">> export POTLUCK_SUBREGISTRY=%s", address(potluckReg));
    }
}
