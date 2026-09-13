// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";
import {NoOpGate} from "../src/identity/NoOpGate.sol";
import {NoOpNaming} from "../src/naming/NoOpNaming.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ROSCAFactory} from "../src/ROSCAFactory.sol";

/// @title Deploy
/// @notice Deploys the PotLuck core stack to Sepolia (or anvil) for the first end-to-end run.
///         Uses the dev-shuffle ROSCAPool (via the factory) and the NoOpGate identity gate, so
///         no VRF subscription is needed to prove the full lifecycle. Swaps come later:
///         factory.setIdentityGate(worldIdGate) and a VRF-backed pool.
///
/// @dev Deployment order breaks the factory<->registry cycle:
///        1. MockUSDC          (test-net stand-in for USDC; open mint/faucet)
///        2. NoOpGate          (identity gate, isLiveGate() == false)
///        3. ROSCAFactory      (points at token + gate + treasury)
///        4. ReputationRegistry(factory)   — registry must know its factory at construction
///        5. factory.setRegistry(registry) — one-time wiring
///
///      Run:
///        forge script script/Deploy.s.sol:Deploy \
///          --rpc-url sepolia --broadcast --verify
///
///      Env: PRIVATE_KEY (deployer), SEPOLIA_RPC_URL, ETHERSCAN_API_KEY.
///      Treasury defaults to the deployer unless TREASURY is set.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("TREASURY", deployer);

        vm.startBroadcast(pk);

        MockUSDC token = new MockUSDC();
        NoOpGate gate = new NoOpGate();
        NoOpNaming naming = new NoOpNaming();
        ROSCAFactory factory = new ROSCAFactory(address(token), address(gate), address(naming), treasury);
        ReputationRegistry registry = new ReputationRegistry(address(factory));
        factory.setRegistry(address(registry));

        vm.stopBroadcast();

        console2.log("== PotLuck deployed ==");
        console2.log("deployer          :", deployer);
        console2.log("treasury          :", treasury);
        console2.log("MockUSDC          :", address(token));
        console2.log("NoOpGate          :", address(gate));
        console2.log("NoOpNaming        :", address(naming));
        console2.log("ROSCAFactory      :", address(factory));
        console2.log("ReputationRegistry:", address(registry));
    }
}
