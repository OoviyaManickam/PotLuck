// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPoolNaming} from "../../src/interfaces/IPoolNaming.sol";

/// @notice A naming adapter that always reverts. Used to prove the ROSCA logic is resilient:
///         even a broken naming layer must not block createPool / join.
contract RevertingNaming is IPoolNaming {
    error Boom();
    function registerPool(uint256) external pure { revert Boom(); }
    function registerMember(uint256, address, bytes32) external pure { revert Boom(); }
    function isLiveNaming() external pure returns (bool) { return true; }
}
