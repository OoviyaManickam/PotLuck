// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IIdentityGate} from "../interfaces/IIdentityGate.sol";

/// @title NoOpGate
/// @notice Development / fallback identity gate. Always passes and derives the reputation
///         key from the wallet address (one wallet = one identity).
/// @dev This is the "fallback posture" from the design: the full ROSCA machine runs with
///      this gate installed, so the mechanic can be proven end-to-end without World ID.
///      Swapping to `WorldIDGate` requires no changes to pool logic — same interface.
///      Because the key is the wallet, reputation is per-wallet here (not per-human);
///      real cross-wallet sybil resistance comes only with the live World ID gate.
contract NoOpGate is IIdentityGate {
    /// @inheritdoc IIdentityGate
    function verifyJoin(address user, uint256, /* poolId */ bytes calldata /* proof */ )
        external
        pure
        returns (bytes32 idKey)
    {
        // No proof to check — identity is simply the wallet.
        return keccak256(abi.encode(user));
    }

    /// @inheritdoc IIdentityGate
    function isLiveGate() external pure returns (bool) {
        return false;
    }
}
