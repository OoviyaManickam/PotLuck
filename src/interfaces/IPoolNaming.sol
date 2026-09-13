// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IPoolNaming
/// @notice The single seam between PotLuck's ROSCA logic and any naming provider (ENS).
///         Pool/factory logic never imports ENS directly — it only knows this interface,
///         so the real ENS adapter and a no-op fallback are interchangeable, exactly like
///         IIdentityGate. See spec §2/§3.
/// @dev BOTH mutating calls MUST be non-reverting in every implementation: naming is a
///      cosmetic layer and must never block a pool create or a member join (spec §5).
interface IPoolNaming {
    /// @notice Register naming for a newly created pool (e.g. mint poolN.potluck.eth and
    ///         attach its child registry). Called by the factory after the pool is deployed.
    /// @dev MUST NOT revert.
    function registerPool(uint256 poolId) external;

    /// @notice Register naming for a member who just joined (e.g. mint member.poolN.potluck.eth
    ///         and record nameHash -> idKey). Called by the pool after slot assignment.
    /// @dev MUST NOT revert.
    function registerMember(uint256 poolId, address member, bytes32 idKey) external;

    /// @notice Whether this adapter performs real on-chain naming (true) or is the no-op default.
    /// @dev Surfaced in events/UI so a demo is honest about which mode is live.
    function isLiveNaming() external view returns (bool);
}
