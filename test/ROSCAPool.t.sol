// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ROSCAPool} from "../src/ROSCAPool.sol";
import {ROSCAPoolHarness} from "./mocks/ROSCAPoolHarness.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {NoOpGate} from "../src/identity/NoOpGate.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice ROSCAPool lifecycle tests. This test contract acts as the "factory" so it can
///         authorize pools on the registry, then drives pools through full cycles.
contract ROSCAPoolTest is Test {
    MockUSDC token;
    NoOpGate gate;
    ReputationRegistry registry;
    address treasury = makeAddr("treasury");

    // 3-member pool, 10 mUSDC/round -> pot 30, collateral 15 each.
    uint256 constant CONTRIB = 10e6;
    uint8 constant N = 3;
    uint256 constant POT = CONTRIB * N; // 30e6
    uint256 constant COLLATERAL = POT / 2; // 15e6
    uint32 constant PERIOD = 1 days;
    uint32 constant WINDOW = 12 hours;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        token = new MockUSDC();
        gate = new NoOpGate();
        // This test contract is the factory -> it can authorize pools.
        registry = new ReputationRegistry(address(this));
    }

    // --------------------------------------------------------------------
    // helpers
    // --------------------------------------------------------------------

    function _newPool(bool inviteOnly) internal returns (ROSCAPoolHarness pool) {
        ROSCAPool.InitParams memory p = ROSCAPool.InitParams({
            poolId: 1,
            creator: alice,
            token: address(token),
            identityGate: address(gate),
            reputation: address(registry),
            treasury: treasury,
            contribution: CONTRIB,
            memberCount: N,
            periodSeconds: PERIOD,
            windowSeconds: WINDOW,
            minScore: 0,
            acceptDefaulted: true,
            inviteOnly: inviteOnly
        });
        pool = new ROSCAPoolHarness(p);
        registry.authorizePool(address(pool));
    }

    function _fund(address who, uint256 amount) internal {
        token.mint(who, amount);
    }

    function _join(ROSCAPoolHarness pool, address who) internal {
        vm.prank(who);
        pool.join("");
    }

    function _fundApprove(ROSCAPoolHarness pool, address who, uint256 amount) internal {
        token.mint(who, amount);
        vm.prank(who);
        token.approve(address(pool), type(uint256).max);
    }

    // --------------------------------------------------------------------
    // join / lock
    // --------------------------------------------------------------------

    function test_JoinLocksAndStartsCycle() public {
        ROSCAPoolHarness pool = _newPool(false);
        pool.setSeed(42);

        _fundApprove(pool, alice, COLLATERAL);
        _fundApprove(pool, bob, COLLATERAL);
        _fundApprove(pool, carol, COLLATERAL);

        _join(pool, alice);
        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.OPEN));
        _join(pool, bob);
        _join(pool, carol); // Nth join locks

        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.ROUND_ACTIVE));
        assertEq(pool.currentRound(), 1);
        assertEq(pool.getPayoutOrder().length, N);
        assertEq(token.balanceOf(address(pool)), COLLATERAL * N);
    }

    function test_CannotJoinTwice() public {
        ROSCAPoolHarness pool = _newPool(false);
        _fundApprove(pool, alice, COLLATERAL * 2);
        _join(pool, alice);
        vm.prank(alice);
        vm.expectRevert(ROSCAPool.AlreadyJoined.selector);
        pool.join("");
    }

    function test_CancelRefundsCollateral() public {
        ROSCAPoolHarness pool = _newPool(false);
        _fundApprove(pool, alice, COLLATERAL);
        _fundApprove(pool, bob, COLLATERAL);
        _join(pool, alice);
        _join(pool, bob);

        vm.prank(alice);
        pool.cancel();
        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.CANCELLED));
        assertEq(token.balanceOf(alice), COLLATERAL);
        assertEq(token.balanceOf(bob), COLLATERAL);
    }

    // --------------------------------------------------------------------
    // full happy path: everyone pays every round
    // --------------------------------------------------------------------

    function test_FullCleanCycle() public {
        ROSCAPoolHarness pool = _newPool(false);
        pool.setSeed(7);

        // fund collateral + 3 rounds of contributions each
        uint256 need = COLLATERAL + CONTRIB * N;
        _fundApprove(pool, alice, need);
        _fundApprove(pool, bob, need);
        _fundApprove(pool, carol, need);

        _join(pool, alice);
        _join(pool, bob);
        _join(pool, carol);

        address[3] memory who = [alice, bob, carol];

        for (uint8 r = 1; r <= N; r++) {
            for (uint256 i = 0; i < 3; i++) {
                vm.prank(who[i]);
                pool.contribute();
            }
            vm.warp(block.timestamp + WINDOW + 1);
            pool.settleRound();
        }

        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.COMPLETE));

        // Everyone completed cleanly -> each idKey has 1 clean cycle, no defaults.
        for (uint256 i = 0; i < 3; i++) {
            bytes32 idKey = keccak256(abi.encode(who[i]));
            assertEq(registry.cleanCycles(idKey), 1, "clean cycle");
            assertFalse(registry.hasDefaulted(idKey), "no default");
        }

        // Conservation: everyone received the pot exactly once. Net position for each
        // member = -3*contrib (paid in) +30 (pot) -collateral +refund. With 2% protocol
        // fee on a 30 pot = 0.6 total, split 0.2 each. So each ends down 0.2 from start.
        // Simplest invariant: pool holds only leftover dust <= fees, treasury got the fee.
        assertGt(token.balanceOf(treasury), 0, "treasury fee");
    }

    // --------------------------------------------------------------------
    // default + slash
    // --------------------------------------------------------------------

    function test_MissSlashesCollateralAndFlagsDefault() public {
        ROSCAPoolHarness pool = _newPool(false);
        pool.setSeed(7);

        uint256 need = COLLATERAL + CONTRIB * N;
        _fundApprove(pool, alice, need);
        _fundApprove(pool, bob, need);
        _fundApprove(pool, carol, need);
        _join(pool, alice);
        _join(pool, bob);
        _join(pool, carol);

        // Round 1: alice and bob pay, carol misses.
        vm.prank(alice);
        pool.contribute();
        vm.prank(bob);
        pool.contribute();

        uint256 carolSlot = pool.slotOfPlusOne(carol) - 1;
        uint256 collBefore = pool.getMember(carolSlot).collateral;

        vm.warp(block.timestamp + WINDOW + 1);
        pool.settleRound();

        ROSCAPool.Member memory carolM = pool.getMember(carolSlot);
        assertEq(carolM.collateral, collBefore - CONTRIB, "slashed one contribution");
        assertTrue(carolM.defaultedThisCycle, "flagged this cycle");
        assertTrue(registry.hasDefaulted(keccak256(abi.encode(carol))), "permanent flag");
    }

    function test_DefaulterGetsNoCleanCycle() public {
        ROSCAPoolHarness pool = _newPool(false);
        pool.setSeed(7);

        uint256 need = COLLATERAL + CONTRIB * N;
        _fundApprove(pool, alice, need);
        _fundApprove(pool, bob, need);
        _fundApprove(pool, carol, need);
        _join(pool, alice);
        _join(pool, bob);
        _join(pool, carol);

        address[3] memory who = [alice, bob, carol];
        for (uint8 r = 1; r <= N; r++) {
            // carol misses round 1 only
            for (uint256 i = 0; i < 3; i++) {
                if (r == 1 && who[i] == carol) continue;
                vm.prank(who[i]);
                pool.contribute();
            }
            vm.warp(block.timestamp + WINDOW + 1);
            pool.settleRound();
        }

        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.COMPLETE));
        // carol defaulted -> no clean cycle; alice & bob clean.
        assertEq(registry.cleanCycles(keccak256(abi.encode(carol))), 0);
        assertEq(registry.cleanCycles(keccak256(abi.encode(alice))), 1);
        assertEq(registry.cleanCycles(keccak256(abi.encode(bob))), 1);
    }

    // --------------------------------------------------------------------
    // guards
    // --------------------------------------------------------------------

    function test_CannotContributeBeforeActive() public {
        ROSCAPoolHarness pool = _newPool(false);
        _fundApprove(pool, alice, COLLATERAL);
        _join(pool, alice); // still OPEN (need 3)
        vm.prank(alice);
        vm.expectRevert(ROSCAPool.WrongStatus.selector);
        pool.contribute();
    }

    function test_CannotSettleBeforeWindowCloses() public {
        ROSCAPoolHarness pool = _newPool(false);
        pool.setSeed(7);
        _fundApprove(pool, alice, COLLATERAL + CONTRIB * N);
        _fundApprove(pool, bob, COLLATERAL + CONTRIB * N);
        _fundApprove(pool, carol, COLLATERAL + CONTRIB * N);
        _join(pool, alice);
        _join(pool, bob);
        _join(pool, carol);

        vm.expectRevert(ROSCAPool.NotYetTimeToAdvance.selector);
        pool.settleRound();
    }

    function test_NonMemberCannotContribute() public {
        ROSCAPoolHarness pool = _newPool(false);
        pool.setSeed(7);
        _fundApprove(pool, alice, COLLATERAL + CONTRIB * N);
        _fundApprove(pool, bob, COLLATERAL + CONTRIB * N);
        _fundApprove(pool, carol, COLLATERAL + CONTRIB * N);
        _join(pool, alice);
        _join(pool, bob);
        _join(pool, carol);

        address dave = makeAddr("dave");
        vm.prank(dave);
        vm.expectRevert(ROSCAPool.NotAMember.selector);
        pool.contribute();
    }
}
