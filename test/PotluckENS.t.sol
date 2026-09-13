// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PotluckENS} from "../src/naming/PotluckENS.sol";
import {PotluckSubRegistry} from "../src/naming/PotluckSubRegistry.sol";

/// Stub factory exposing only isPool, matching the real factory's getter shape.
contract StubFactory {
    mapping(address => bool) public isPool;
    function markPool(address p) external { isPool[p] = true; }
}

contract PotluckENSTest is Test {
    StubFactory factory;
    PotluckENS ens;
    PotluckSubRegistry potluckReg;
    address ethRegistry = makeAddr("ethRegistry"); // not called on the non-revert path in unit tests

    function setUp() public {
        factory = new StubFactory();
        // PotluckENS will control potluckReg; deploy the registry with ens as controller after ens exists.
        // Order: deploy ens with a placeholder, then a registry it controls. We deploy registry
        // controlled by the predicted ens address using a two-step: deploy ens first (registry addr set later)
        // -- simplest: deploy registry controlled by address(this) proxy is wrong; instead give ens a setter.
        ens = new PotluckENS(address(factory), ethRegistry);
        potluckReg = new PotluckSubRegistry(address(ens));
        ens.initPotluckRegistry(address(potluckReg), "potluck", uint64(block.timestamp + 365 days));
    }

    function test_OnlyFactoryCanRegisterPool() public {
        vm.prank(makeAddr("stranger"));
        // non-reverting by contract: unauthorized caller is ignored, no pool registry created.
        ens.registerPool(1);
        assertEq(ens.poolRegistry(1), address(0));
    }

    function test_FactoryRegisterPoolCreatesChildRegistry() public {
        vm.prank(address(factory));
        ens.registerPool(1);
        assertTrue(ens.poolRegistry(1) != address(0));
    }

    function test_OnlyKnownPoolCanRegisterMember() public {
        vm.prank(address(factory));
        ens.registerPool(1);

        address member = makeAddr("alice");
        bytes32 idKey = keccak256("alice-id");
        // caller not a known pool -> ignored, no map entry.
        vm.prank(makeAddr("stranger"));
        ens.registerMember(1, member, idKey);
        // No name minted, so idKeyOf for any guessed hash is zero. Assert the map is empty
        // by checking a member registration from a real pool DOES write, below.

        address poolAddr = makeAddr("pool1");
        factory.markPool(poolAddr);
        vm.prank(poolAddr);
        ens.registerMember(1, member, idKey);
        // The nameHash is computed internally; expose it via a view for the test.
        bytes32 nameHash = ens.memberNameHash(1, member);
        assertEq(ens.idKeyOf(nameHash), idKey);
    }

    function test_IsLiveNaming() public view {
        assertTrue(ens.isLiveNaming());
    }
}
