// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IIdentityGate
/// @notice The single seam between PotLuck's ROSCA logic and any identity provider.
///         Pool logic never imports a provider directly — it only knows this interface,
///         so the real World ID implementation and a no-op fallback are interchangeable.
/// @dev See spec §2. `verifyJoin` returns an `idKey` that is used everywhere reputation
///      is tracked. With World ID this is the nullifier hash (stable per human), so
///      behaviour cannot be shed by switching wallets. With the no-op fallback it degrades
///      to a per-wallet key. Pool logic is identical either way.
interface IIdentityGate {
    /// @notice Verify that a live, real human is present and bind them to a pool join.
    /// @dev MUST revert if the proof is invalid or (for real gates) the human already
    ///      used their credential for this action. On success returns the reputation key.
    /// @param user   the wallet joining the pool
    /// @param poolId the pool being joined (used as the World ID signal)
    /// @param proof  opaque proof bytes — World ID: abi.encode(root, nullifierHash, uint256[8]);
    ///               ignored by the no-op gate
    /// @return idKey stable per-human key used as the reputation key
    function verifyJoin(address user, uint256 poolId, bytes calldata proof)
        external
        returns (bytes32 idKey);

    /// @notice Whether this gate enforces real personhood (true) or is the dev fallback (false).
    /// @dev Surfaced in events/UI so a demo is honest about which mode is live.
    function isLiveGate() external view returns (bool);
}
