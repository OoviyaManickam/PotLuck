// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPoolNaming} from "../interfaces/IPoolNaming.sol";

/// @title NoOpNaming
/// @notice Default / fallback naming adapter. Does nothing, so the whole ROSCA machine runs
///         with no ENS dependency (all existing tests use it). Swapping to PotluckENS requires
///         no changes to factory/pool logic — same interface. Mirrors NoOpGate. Spec §3.
contract NoOpNaming is IPoolNaming {
    /// @inheritdoc IPoolNaming
    function registerPool(uint256 /* poolId */ ) external {}

    /// @inheritdoc IPoolNaming
    function registerMember(uint256, /* poolId */ address, /* member */ bytes32 /* idKey */ ) external {}

    /// @inheritdoc IPoolNaming
    function isLiveNaming() external pure returns (bool) {
        return false;
    }
}
