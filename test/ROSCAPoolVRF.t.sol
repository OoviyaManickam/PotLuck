// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ROSCAPool} from "../src/ROSCAPool.sol";
import {ROSCAPoolVRF} from "../src/ROSCAPoolVRF.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {NoOpGate} from "../src/identity/NoOpGate.sol";
import {NoOpNaming} from "../src/naming/NoOpNaming.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {VRFCoordinatorV2_5Mock} from
    "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

/// @notice Verifies the VRF variant: locking requests randomness, and the coordinator
///         callback sets the payout order and starts round 1.
contract ROSCAPoolVRFTest is Test {
    MockUSDC token;
    NoOpGate gate;
    ReputationRegistry registry;
    VRFCoordinatorV2_5Mock coordinator;
    address treasury = makeAddr("treasury");

    uint256 constant CONTRIB = 10e6;
    uint8 constant N = 3;
    uint256 constant COLLATERAL = (CONTRIB * N) / 2;

    bytes32 constant KEY_HASH = keccak256("gwei-keyhash");
    uint256 subId;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    ROSCAPoolVRF pool;

    function setUp() public {
        token = new MockUSDC();
        gate = new NoOpGate();
        registry = new ReputationRegistry(address(this)); // this = factory

        // baseFee, gasPrice, weiPerUnitLink
        coordinator = new VRFCoordinatorV2_5Mock(0.1 ether, 1e9, 4e15);
        subId = coordinator.createSubscription();
        coordinator.fundSubscription(subId, 100 ether);

        ROSCAPool.InitParams memory p = ROSCAPool.InitParams({
            poolId: 1,
            creator: alice,
            token: address(token),
            identityGate: address(gate),
            reputation: address(registry),
            naming: address(new NoOpNaming()),
            treasury: treasury,
            contribution: CONTRIB,
            memberCount: N,
            periodSeconds: 1 days,
            windowSeconds: 12 hours,
            minScore: 0,
            acceptDefaulted: true,
            inviteOnly: false
        });
        ROSCAPoolVRF.VRFParams memory v = ROSCAPoolVRF.VRFParams({
            coordinator: address(coordinator),
            keyHash: KEY_HASH,
            subscriptionId: subId,
            requestConfirmations: 3,
            callbackGasLimit: 500_000
        });
        pool = new ROSCAPoolVRF(p, v);

        registry.authorizePool(address(pool));
        coordinator.addConsumer(subId, address(pool));

        _fundApprove(alice);
        _fundApprove(bob);
        _fundApprove(carol);
    }

    function _fundApprove(address who) internal {
        token.mint(who, COLLATERAL);
        vm.prank(who);
        token.approve(address(pool), type(uint256).max);
    }

    function _join(address who) internal {
        vm.prank(who);
        pool.join("");
    }

    function test_LockRequestsVRFAndStaysLockedUntilFulfilled() public {
        _join(alice);
        _join(bob);
        _join(carol); // Nth join locks + requests randomness

        // Randomness not yet delivered -> still LOCKED, no order.
        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.LOCKED));
        assertEq(pool.getPayoutOrder().length, 0);
        assertGt(pool.lastRequestId(), 0, "request made");
    }

    function test_FulfillStartsCycle() public {
        _join(alice);
        _join(bob);
        _join(carol);

        uint256 reqId = pool.lastRequestId();
        coordinator.fulfillRandomWords(reqId, address(pool));

        assertEq(uint256(pool.status()), uint256(ROSCAPool.Status.ROUND_ACTIVE));
        assertEq(pool.currentRound(), 1);
        assertEq(pool.getPayoutOrder().length, N);

        // order is a permutation of [0..N-1]
        uint8[] memory order = pool.getPayoutOrder();
        uint256 sum;
        for (uint256 i = 0; i < order.length; i++) {
            sum += order[i];
            assertLt(order[i], N);
        }
        assertEq(sum, 0 + 1 + 2);
    }

    function test_OnlyCoordinatorCanFulfill() public {
        _join(alice);
        _join(bob);
        _join(carol);

        uint256 reqId = pool.lastRequestId();
        uint256[] memory words = new uint256[](1);
        words[0] = 123;
        // Only the coordinator may deliver randomness; a direct call must revert.
        vm.expectRevert();
        pool.rawFulfillRandomWords(reqId, words);
    }
}
