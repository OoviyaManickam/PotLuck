// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ROSCAPool} from "../../src/ROSCAPool.sol";

/// @title ROSCAPoolHarness
/// @notice Test-only subclass that makes the randomness seam controllable, so the payout
///         order is deterministic in tests. Production randomness (dev pseudo-random or
///         Chainlink VRF) is unchanged in ROSCAPool.
contract ROSCAPoolHarness is ROSCAPool {
    uint256 private seed;
    bool private seedSet;

    constructor(InitParams memory p) ROSCAPool(p) {}

    /// @notice Preset the seed used when the pool locks. Call before the final join().
    function setSeed(uint256 s) external {
        seed = s;
        seedSet = true;
    }

    function _requestRandomness() internal override {
        _onRandomness(seedSet ? seed : uint256(keccak256(abi.encode(block.timestamp))));
    }
}
