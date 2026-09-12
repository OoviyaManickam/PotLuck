// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ROSCAPool} from "./ROSCAPool.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/// @title ROSCAPoolVRF
/// @notice ROSCAPool variant that draws the payout order from Chainlink VRF v2.5 instead of
///         the dev pseudo-random shuffle. Spec §5.4 / task #11.
/// @dev Overrides the randomness seam: `_requestRandomness` asks the VRF coordinator for one
///      word; `fulfillRandomWords` (coordinator-only) feeds it into the base `_onRandomness`,
///      which shuffles the order and starts round 1.
///
///      Requires a funded VRF v2.5 subscription (testnet LINK on Sepolia — free from a faucet)
///      with this pool added as a consumer. Because a pool is deployed per cycle by the
///      factory, the subscription must allow the pool as a consumer; on Sepolia this is done
///      by the deployer/owner of the subscription after pool creation, or by using a
///      subscription owned by the factory. For the first end-to-end run the base dev-shuffle
///      ROSCAPool is used so the flow needs no subscription; this variant is the swap-in.
contract ROSCAPoolVRF is ROSCAPool, VRFConsumerBaseV2Plus {
    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;
    uint16 public immutable requestConfirmations;
    uint32 public immutable callbackGasLimit;

    uint256 public lastRequestId;

    event RandomnessRequested(uint256 indexed requestId);

    struct VRFParams {
        address coordinator;
        bytes32 keyHash;
        uint256 subscriptionId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
    }

    constructor(InitParams memory p, VRFParams memory v)
        ROSCAPool(p)
        VRFConsumerBaseV2Plus(v.coordinator)
    {
        keyHash = v.keyHash;
        subscriptionId = v.subscriptionId;
        requestConfirmations = v.requestConfirmations;
        callbackGasLimit = v.callbackGasLimit;
    }

    /// @dev Override the seam: request one random word from the VRF coordinator.
    function _requestRandomness() internal override {
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: requestConfirmations,
            callbackGasLimit: callbackGasLimit,
            numWords: 1,
            // pay the VRF fee in LINK (not native)
            extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
        });
        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);
        lastRequestId = requestId;
        emit RandomnessRequested(requestId);
    }

    /// @dev Coordinator-only callback (guarded by rawFulfillRandomWords in the base).
    function fulfillRandomWords(uint256, /* requestId */ uint256[] calldata randomWords) internal override {
        _onRandomness(randomWords[0]);
    }
}
