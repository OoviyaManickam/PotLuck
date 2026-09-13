// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PotluckENS} from "../src/naming/PotluckENS.sol";

interface IFactorySetNaming {
    function setNaming(address naming_) external;
    function naming() external view returns (address);
    function owner() external view returns (address);
}

/// @title WirePotluckEns
/// @notice PHASE 3 of ENS go-live: after potluck.eth is registered (Phase 1) with the child
///         registry + resolver attached at the ETHRegistry, finish the wiring.
///
///         Two OWNER-gated txs, both callable by MEMBER1 (the PotluckENS + factory owner):
///           1. initStep()        -> ens.initPotluckRegistry(potluckReg, "potluck", expiry) — one-time
///           2. swapNamingStep()  -> factory.setNaming(ens)  — swap NoOpNaming -> PotluckENS
///
///         WHY NO setParent: the potluck-node PotluckSubRegistry.setParent is `onlyController`, and
///         its controller is PotluckENS (not MEMBER1), so MEMBER1 can't call it directly. More
///         importantly it's unnecessary: UniversalResolverV2 traversal walks DOWNWARD via
///         getSubregistry/getResolver (proven in the spike) and registerPool sets each pool
///         registry's parent itself (PotluckENS.sol:70). The potluck node's own getParent() is read
///         by nothing in the resolve or mint path, so setting it is cosmetic. Dropped.
///
///         Each entrypoint is a SEPARATE single-tx broadcast on purpose: MEMBER1 is an EIP-7702
///         delegated account that Alchemy throttles to ~1 in-flight tx, so batching multiple
///         broadcasts fails with "in-flight transaction limit reached". Run them one at a time:
///           forge script script/WirePotluckEns.s.sol:WirePotluckEns --sig "initStep()"       --rpc-url "$RPC" --broadcast
///           forge script script/WirePotluckEns.s.sol:WirePotluckEns --sig "swapNamingStep()" --rpc-url "$RPC" --broadcast
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
    string constant LABEL = "potluck";

    function _pk() internal view returns (uint256) {
        return vm.envUint("PRIVATE_KEY");
    }

    function _ens() internal view returns (address) {
        return vm.envAddress("POTLUCK_ENS");
    }

    /// STEP 1 — arm PotluckENS with its potluck-node child registry (one-time; reverts
    /// AlreadyInitialized if re-run). This is what turns registerPool() into a live mint.
    function initStep() external {
        address ensAddr = _ens();
        address subAddr = vm.envAddress("POTLUCK_SUBREGISTRY");
        uint64 duration = uint64(vm.envOr("REG_DURATION", uint256(31536000)));
        // Store an expiry a hair under the on-chain registration so our node never claims to outlive it.
        uint64 expiry = uint64(block.timestamp) + duration;

        PotluckENS ens = PotluckENS(ensAddr);

        console2.log("== Phase 3 / initStep ==");
        console2.log("PotluckENS          :", ensAddr);
        console2.log("potluckRegistry (in):", subAddr);
        console2.log("expiry              :", expiry);

        vm.startBroadcast(_pk());
        ens.initPotluckRegistry(subAddr, LABEL, expiry);
        vm.stopBroadcast();

        console2.log("initialized. potluckRegistry (out):", address(ens.potluckRegistry()));
        console2.log(">> Next: run swapNamingStep() to point the factory at PotluckENS.");
    }

    /// STEP 2 — swap the factory's naming adapter to the live one. New pools auto-mint from here.
    function swapNamingStep() external {
        address ensAddr = _ens();
        address factoryAddr = vm.envAddress("FACTORY");
        IFactorySetNaming factory = IFactorySetNaming(factoryAddr);

        console2.log("== Phase 3 / swapNamingStep ==");
        console2.log("factory.owner()    :", factory.owner());
        console2.log("naming (before)    :", factory.naming());

        vm.startBroadcast(_pk());
        factory.setNaming(ensAddr);
        vm.stopBroadcast();

        console2.log("naming (after)     :", factory.naming());
        console2.log(">> Live. Create a new pool to mint pool<N>.potluck.eth on-chain.");
        console2.log(">> Frontend: re-point ADDRESSES.noOpNaming -> %s in client/src/lib/contracts.ts", ensAddr);
    }
}
