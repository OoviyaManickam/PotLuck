// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {Tiers} from "../src/Tiers.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry registry;

    address factory = makeAddr("factory");
    address pool = makeAddr("pool");
    address stranger = makeAddr("stranger");

    bytes32 constant ALICE = keccak256("alice");
    bytes32 constant BOB = keccak256("bob");

    event PoolAuthorized(address indexed pool);
    event ReputationUpdated(bytes32 indexed idKey, uint32 cleanCycles, bool hasDefaulted);

    function setUp() public {
        registry = new ReputationRegistry(factory);
    }

    // --- authorization ---

    function test_OnlyFactoryCanAuthorize() public {
        vm.prank(stranger);
        vm.expectRevert(ReputationRegistry.NotFactory.selector);
        registry.authorizePool(pool);
    }

    function test_FactoryAuthorizesPool() public {
        vm.expectEmit(true, false, false, false);
        emit PoolAuthorized(pool);
        vm.prank(factory);
        registry.authorizePool(pool);
        assertTrue(registry.authorizedPools(pool));
    }

    function test_UnauthorizedPoolCannotWrite() public {
        vm.prank(pool); // not yet authorized
        vm.expectRevert(ReputationRegistry.NotAuthorizedPool.selector);
        registry.recordCleanCycle(ALICE);
    }

    // --- clean cycles ---

    function test_RecordCleanCycleIncrements() public {
        _authorize(pool);
        vm.startPrank(pool);
        registry.recordCleanCycle(ALICE);
        assertEq(registry.cleanCycles(ALICE), 1);
        registry.recordCleanCycle(ALICE);
        assertEq(registry.cleanCycles(ALICE), 2);
        vm.stopPrank();
    }

    function test_CleanCycleEmitsEvent() public {
        _authorize(pool);
        vm.expectEmit(true, false, false, true);
        emit ReputationUpdated(ALICE, 1, false);
        vm.prank(pool);
        registry.recordCleanCycle(ALICE);
    }

    // --- defaults (Q2: flag set, count NOT frozen) ---

    function test_RecordDefaultSetsPermanentFlag() public {
        _authorize(pool);
        vm.prank(pool);
        registry.recordDefault(ALICE);
        assertTrue(registry.hasDefaulted(ALICE));
    }

    function test_DefaultDoesNotFreezeCleanCycles() public {
        _authorize(pool);
        vm.startPrank(pool);
        registry.recordCleanCycle(ALICE); // 1
        registry.recordDefault(ALICE); // flagged
        registry.recordCleanCycle(ALICE); // 2 — still counts (Q2)
        vm.stopPrank();
        assertEq(registry.cleanCycles(ALICE), 2);
        assertTrue(registry.hasDefaulted(ALICE));
    }

    // --- tiers ---

    function test_TierProgression() public {
        _authorize(pool);
        assertEq(uint256(registry.tierOf(BOB)), uint256(Tiers.Tier.New)); // 0

        vm.startPrank(pool);
        registry.recordCleanCycle(BOB); // 1 -> Bronze
        assertEq(uint256(registry.tierOf(BOB)), uint256(Tiers.Tier.Bronze));
        registry.recordCleanCycle(BOB); // 2 -> Bronze
        registry.recordCleanCycle(BOB); // 3 -> Silver
        assertEq(uint256(registry.tierOf(BOB)), uint256(Tiers.Tier.Silver));
        registry.recordCleanCycle(BOB); // 4
        registry.recordCleanCycle(BOB); // 5 -> Silver
        registry.recordCleanCycle(BOB); // 6 -> Gold
        assertEq(uint256(registry.tierOf(BOB)), uint256(Tiers.Tier.Gold));
        vm.stopPrank();
    }

    function test_TierCaps() public pure {
        assertEq(Tiers.maxContribution(Tiers.Tier.New), 25e6);
        assertEq(Tiers.maxMembers(Tiers.Tier.New), 6);
        assertEq(Tiers.maxContribution(Tiers.Tier.Bronze), 100e6);
        assertEq(Tiers.maxMembers(Tiers.Tier.Bronze), 10);
        assertEq(Tiers.maxContribution(Tiers.Tier.Silver), 500e6);
        assertEq(Tiers.maxMembers(Tiers.Tier.Silver), 12);
        assertEq(Tiers.maxContribution(Tiers.Tier.Gold), type(uint256).max);
        assertEq(Tiers.maxMembers(Tiers.Tier.Gold), type(uint256).max);
    }

    function _authorize(address p) internal {
        vm.prank(factory);
        registry.authorizePool(p);
    }
}
