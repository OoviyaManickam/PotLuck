// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PotluckENS} from "../src/naming/PotluckENS.sol";
import {PotluckSubRegistry} from "../src/naming/PotluckSubRegistry.sol";
import {IRegistry} from "../src/interfaces/IENSv2.sol";

interface IFactorySetNaming {
    function setNaming(address naming_) external;
    function naming() external view returns (address);
    function owner() external view returns (address);
}

/// @title WirePotluckEns
/// @notice PHASE 3 of ENS go-live: after potluck.eth is registered (Phase 1) with the child
///         registry + resolver attached at the ETHRegistry, finish the wiring:
///           1. potluckReg.setParent(ETHRegistry, "potluck")  — so traversal walks upward correctly
///           2. ens.initPotluckRegistry(potluckReg, "potluck", expiry) — one-time, arms auto-mint
///           3. factory.setNaming(ens)                          — swap NoOpNaming -> PotluckENS
///
///         From here, every NEW pool's createPool() calls ens.registerPool(poolId), which mints
///         poolN.potluck.eth under our registry; members resolve <addr>.poolN.potluck.eth to live
///         reputation via the resolver inherited from potluck.eth. (Existing pools are NOT
///         backfilled — "new pools only", per scope.)
///
///         Env required:
///           PRIVATE_KEY          MEMBER1 (factory owner + PotluckENS owner)
///           FACTORY              ROSCAFactory (0xe1dA53345211C225A072fCaa3d16D611F39f5e4F)
///           POTLUCK_ENS          from Phase 2
///           POTLUCK_SUBREGISTRY  from Phase 2
///         Optional:
///           REG_DURATION         must MATCH the value used in Phase 1 (default 31536000). The
///                                expiry stored here should be <= the potluck.eth registration expiry.
contract WirePotluckEns is Script {
    address constant ETH_REGISTRY = 0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2;
    string constant LABEL = "potluck";

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("FACTORY");
        address ensAddr = vm.envAddress("POTLUCK_ENS");
        address subAddr = vm.envAddress("POTLUCK_SUBREGISTRY");
        uint64 duration = uint64(vm.envOr("REG_DURATION", uint256(31536000)));
        // Store an expiry a hair under the on-chain registration so our node never claims to outlive it.
        uint64 expiry = uint64(block.timestamp) + duration;

        PotluckENS ens = PotluckENS(ensAddr);
        PotluckSubRegistry potluckReg = PotluckSubRegistry(subAddr);
        IFactorySetNaming factory = IFactorySetNaming(factoryAddr);

        console2.log("== Phase 3: wiring ==");
        console2.log("factory.owner()    :", factory.owner());
        console2.log("naming (before)    :", factory.naming());

        vm.startBroadcast(pk);

        // 1. Point the potluck child registry's parent at the real ETHRegistry under "potluck".
        potluckReg.setParent(IRegistry(ETH_REGISTRY), LABEL);

        // 2. Arm PotluckENS with its potluck-node registry (one-time).
        ens.initPotluckRegistry(subAddr, LABEL, expiry);

        // 3. Swap the factory's naming adapter to the live one. New pools auto-mint from here.
        factory.setNaming(ensAddr);

        vm.stopBroadcast();

        console2.log("naming (after)     :", factory.naming());
        console2.log(">> Live. Create a new pool to mint pool<N>.potluck.eth on-chain.");
        console2.log(">> Frontend: re-point ADDRESSES.noOpNaming -> %s in client/src/lib/contracts.ts", ensAddr);
    }
}
