// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ReputationResolver} from "../src/naming/ReputationResolver.sol";
import {PotluckENS} from "../src/naming/PotluckENS.sol";
import {PotluckSubRegistry} from "../src/naming/PotluckSubRegistry.sol";
import {IRegistry} from "../src/interfaces/IENSv2.sol";

/// @title DeployPotluckEns
/// @notice PHASE 2 of ENS go-live: deploy the three naming contracts and wire the ones that don't
///         depend on `potluck.eth` existing yet. Run this FIRST — Phase 1 (RegisterPotluckEth) needs
///         the subregistry + resolver addresses this prints.
///
///         Dependency order (each constructor only stores addresses, so this order is forced):
///           1. ReputationResolver(nameKeySource = PotluckENS, reputation = ReputationRegistry)
///              -> but PotluckENS isn't deployed yet, and PotluckENS is what implements INameKey.
///              The resolver reads names.idKeyOf(...) at RESOLVE time only, so we can deploy the
///              resolver pointing at the (soon-to-exist) PotluckENS address via CREATE nonce math?
///              Simpler + safe: deploy PotluckENS FIRST, then the resolver pointing at it.
///           2. PotluckENS(factory, ethRegistry)      — the INameKey source + naming adapter
///           3. ReputationResolver(PotluckENS, ReputationRegistry)
///           4. PotluckSubRegistry(controller = PotluckENS)   — the `potluck` node's child registry
///
///         After this script:
///           - Run Phase 1 with POTLUCK_SUBREGISTRY + REPUTATION_RESOLVER set to the printed values.
///           - Then run Phase 3 (WirePotluckEns) to setParent + initPotluckRegistry + factory.setNaming.
///
///         Env required:
///           PRIVATE_KEY     MEMBER1 deployer key (must be the factory owner)
///           FACTORY         ROSCAFactory address       (0xe1dA53345211C225A072fCaa3d16D611F39f5e4F)
///           REPUTATION_REGISTRY  ReputationRegistry     (0xC040A3819f6ecd30AD8416D7dA5FB7F41A7A577F)
contract DeployPotluckEns is Script {
    // ENSv2 Sepolia beta ETHRegistry (the real mint site; PotluckENS stores it for reference).
    address constant ETH_REGISTRY = 0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factory = vm.envAddress("FACTORY");
        address reputationRegistry = vm.envAddress("REPUTATION_REGISTRY");

        vm.startBroadcast(pk);

        // 1. PotluckENS — the naming adapter and the INameKey source the resolver reads.
        PotluckENS ens = new PotluckENS(factory, ETH_REGISTRY);

        // 2. ReputationResolver — reads live reputation via names.idKeyOf() -> reputation.tierOf().
        //    Must advertise IExtendedResolver (it does; verified in the resolver source).
        ReputationResolver resolver = new ReputationResolver(address(ens), reputationRegistry);

        // 3. The `potluck` node's child registry, controlled by PotluckENS.
        PotluckSubRegistry potluckReg = new PotluckSubRegistry(address(ens));

        vm.stopBroadcast();

        console2.log("== Phase 2: PotLuck ENS contracts deployed ==");
        console2.log("PotluckENS         :", address(ens));
        console2.log("ReputationResolver :", address(resolver));
        console2.log("PotluckSubRegistry :", address(potluckReg));
        console2.log("");
        console2.log(">> Set these in your shell for Phase 1 + Phase 3:");
        console2.log("   export POTLUCK_ENS=%s", address(ens));
        console2.log("   export POTLUCK_SUBREGISTRY=%s", address(potluckReg));
        console2.log("   export REPUTATION_RESOLVER=%s", address(resolver));
    }
}
