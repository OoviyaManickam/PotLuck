// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ROSCAFactory} from "../src/ROSCAFactory.sol";
import {ROSCAPool} from "../src/ROSCAPool.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {NoOpGate} from "../src/identity/NoOpGate.sol";
import {NoOpNaming} from "../src/naming/NoOpNaming.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract ROSCAFactoryTest is Test {
    MockUSDC token;
    NoOpGate gate;
    NoOpNaming naming;
    ROSCAFactory factory;
    ReputationRegistry registry;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");

    function setUp() public {
        token = new MockUSDC();
        gate = new NoOpGate();
        naming = new NoOpNaming();
        // Deploy factory first, then registry pointing at it, then wire.
        factory = new ROSCAFactory(address(token), address(gate), address(naming), treasury);
        registry = new ReputationRegistry(address(factory));
        factory.setRegistry(address(registry));
    }

    function _cfg(uint256 contrib, uint8 n) internal pure returns (ROSCAFactory.PoolConfig memory) {
        return ROSCAFactory.PoolConfig({
            contribution: contrib,
            memberCount: n,
            periodSeconds: 1 days,
            windowSeconds: 12 hours,
            minScore: 0,
            acceptDefaulted: true,
            inviteOnly: false
        });
    }

    function test_SetRegistryOnce() public {
        vm.expectRevert(ROSCAFactory.RegistryAlreadySet.selector);
        factory.setRegistry(address(registry));
    }

    function test_OnlyOwnerSetsRegistry() public {
        ROSCAFactory f2 = new ROSCAFactory(address(token), address(gate), address(naming), treasury);
        vm.prank(alice);
        vm.expectRevert(ROSCAFactory.NotOwner.selector);
        f2.setRegistry(address(registry));
    }

    function test_CreatePoolBelowFloorReverts() public {
        vm.prank(alice);
        vm.expectRevert(ROSCAFactory.BelowMinMembers.selector);
        factory.createPool(_cfg(10e6, 2), ""); // 2 < 3
    }

    function test_NewUserExceedsTierReverts() public {
        // New tier (0 clean cycles): max contribution 25e6, max members 6.
        vm.prank(alice);
        vm.expectRevert(ROSCAFactory.ExceedsCreatorTier.selector);
        factory.createPool(_cfg(100e6, 3), ""); // 100 > 25 cap
    }

    function test_NewUserCanCreateSmallPool() public {
        vm.prank(alice);
        address pool = factory.createPool(_cfg(10e6, 3), ""); // within New tier
        assertEq(factory.poolCount(), 1);
        assertEq(factory.allPools(0), pool);
        assertTrue(registry.authorizedPools(pool), "pool authorized to write reputation");
    }

    function test_CreatedPoolIsUsable() public {
        vm.prank(alice);
        address poolAddr = factory.createPool(_cfg(10e6, 3), "");
        ROSCAPool pool = ROSCAPool(poolAddr);

        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.OPEN));
        assertEq(pool.creator(), alice);
        assertEq(pool.collateralReq(), (10e6 * 3) / 2);

        // Creator joins via the normal path (Q3) — no auto-enrollment.
        token.mint(alice, pool.collateralReq());
        vm.startPrank(alice);
        token.approve(poolAddr, type(uint256).max);
        pool.join("");
        vm.stopPrank();
        assertEq(pool.memberCountJoined(), 1);
    }

    function test_PoolIdsIncrement() public {
        vm.startPrank(alice);
        factory.createPool(_cfg(10e6, 3), "");
        factory.createPool(_cfg(10e6, 3), "");
        vm.stopPrank();
        assertEq(factory.poolCount(), 2);
        assertEq(ROSCAPool(factory.allPools(0)).poolId(), 0);
        assertEq(ROSCAPool(factory.allPools(1)).poolId(), 1);
    }

    function test_IsPoolTrueForCreatedFalseOtherwise() public {
        vm.prank(alice);
        address pool = factory.createPool(_cfg(10e6, 3), "");
        assertTrue(factory.isPool(pool));
        assertFalse(factory.isPool(makeAddr("stranger")));
    }

    function test_OnlyOwnerSetsNaming() public {
        vm.prank(alice);
        vm.expectRevert(ROSCAFactory.NotOwner.selector);
        factory.setNaming(makeAddr("newNaming"));
    }
}
