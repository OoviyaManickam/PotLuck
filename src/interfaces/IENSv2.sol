// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Minimal ENSv2 Sepolia beta interfaces — hand-declared to avoid recompiling the whole
// ensdomains/contracts-v2 tree (conflicting nested remappings). Every signature here was
// verified on-chain and in a passing fork spike (test/ens_spike/EnsHierarchySpike.t.sol).

/// @notice The three views the real UniversalResolverV2 traversal ever calls, plus nothing else.
interface IRegistry {
    function getSubregistry(string calldata label) external view returns (IRegistry);
    function getResolver(string calldata label) external view returns (address);
    function getParent() external view returns (IRegistry parent, string memory label);
}

/// @notice The subset of PermissionedRegistry PotluckENS exercises. `anyId` for
///         setSubregistry/setResolver is the labelhash (keccak256(label)).
interface IPermissionedRegistry is IRegistry {
    function register(
        string calldata label,
        address owner,
        IRegistry subregistry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    function setSubregistry(uint256 anyId, IRegistry registry) external;
    function setResolver(uint256 anyId, address resolver) external;
    function grantRoles(uint256 anyId, uint256 roleBitmap, address account) external returns (bool);
    function hasRootRoles(uint256 roleBitmap, address account) external view returns (bool);
}

/// @notice ENSIP-10 resolver entrypoint. ENSv2 resolvers are resolve()-only (no classic text/addr).
interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
