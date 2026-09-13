// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IRegistry} from "../interfaces/IENSv2.sol";

/// @title PotluckSubRegistry
/// @notice A minimal IRegistry that PotLuck owns for the `potluck` node and each `poolN` node,
///         so member subnames hang beneath them. The real UniversalResolverV2 traversal only
///         calls getSubregistry/getResolver/getParent (proven in the spike), so this is the
///         entire faithful surface. Mutations are gated to the PotluckENS controller. Spec §3/§6.
contract PotluckSubRegistry is IRegistry {
    address public immutable controller;

    mapping(bytes32 => IRegistry) internal _sub;
    mapping(bytes32 => address) internal _resolver;
    IRegistry internal _parent;
    string internal _label;

    error NotController();

    modifier onlyController() {
        if (msg.sender != controller) revert NotController();
        _;
    }

    constructor(address controller_) {
        controller = controller_;
    }

    function setSub(string calldata label, IRegistry r) external onlyController {
        _sub[keccak256(bytes(label))] = r;
    }

    function setResolverFor(string calldata label, address r) external onlyController {
        _resolver[keccak256(bytes(label))] = r;
    }

    function setParent(IRegistry parent, string calldata label) external onlyController {
        _parent = parent;
        _label = label;
    }

    function getSubregistry(string calldata label) external view returns (IRegistry) {
        return _sub[keccak256(bytes(label))];
    }

    function getResolver(string calldata label) external view returns (address) {
        return _resolver[keccak256(bytes(label))];
    }

    function getParent() external view returns (IRegistry, string memory) {
        return (_parent, _label);
    }
}
