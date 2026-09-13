// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPoolNaming} from "../interfaces/IPoolNaming.sol";
import {INameKey} from "./ReputationResolver.sol";
import {IPermissionedRegistry, IRegistry} from "../interfaces/IENSv2.sol";
import {PotluckSubRegistry} from "./PotluckSubRegistry.sol";

interface IFactoryPools {
    function isPool(address account) external view returns (bool);
}

/// @title PotluckENS
/// @notice The real naming adapter. Mints poolN.potluck.eth and member.poolN.potluck.eth on the
///         ENSv2 registries PotLuck controls, and records nameHash -> idKey so ReputationResolver
///         can answer live reputation. All external ENS calls are wrapped so naming can NEVER
///         revert a pool create or a member join (spec §5). Caller-gated: only the factory may
///         registerPool; only a known pool may registerMember (spec §6).
contract PotluckENS is IPoolNaming, INameKey {
    address public immutable owner;
    IFactoryPools public immutable factory;
    address public immutable ethRegistry;   // real ETHRegistry (mint site on a fork; unused off-fork)

    PotluckSubRegistry public potluckRegistry; // child registry for the `potluck` node
    string public potluckLabel;
    uint64 public expiry;
    bool private initialized;

    mapping(uint256 => address) public poolRegistry;   // poolId => its PotluckSubRegistry
    mapping(bytes32 => bytes32) public idKeyOf;         // namehash => reputation idKey (INameKey)

    event NamingFailed(uint256 indexed poolId, address indexed member, string reason);
    event PoolNamed(uint256 indexed poolId, string label);
    event MemberNamed(uint256 indexed poolId, address indexed member, bytes32 nameHash);

    error NotOwner();
    error AlreadyInitialized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address factory_, address ethRegistry_) {
        owner = msg.sender;
        factory = IFactoryPools(factory_);
        ethRegistry = ethRegistry_;
    }

    /// @notice Wire the potluck-node child registry (must be controlled by this contract). One-time.
    function initPotluckRegistry(address potluckRegistry_, string calldata potluckLabel_, uint64 expiry_)
        external
        onlyOwner
    {
        if (initialized) revert AlreadyInitialized();
        potluckRegistry = PotluckSubRegistry(potluckRegistry_);
        potluckLabel = potluckLabel_;
        expiry = expiry_;
        initialized = true;
    }

    /// @inheritdoc IPoolNaming
    function registerPool(uint256 poolId) external {
        if (msg.sender != address(factory)) return; // caller-gate: silently ignore, never revert
        if (poolRegistry[poolId] != address(0)) return;

        string memory label = _poolLabel(poolId);
        // Create this pool's child registry (controlled by us) and attach it under `potluck`.
        PotluckSubRegistry poolReg = new PotluckSubRegistry(address(this));
        poolReg.setParent(IRegistry(address(potluckRegistry)), label);
        poolRegistry[poolId] = address(poolReg);

        // Attach into our potluck node registry. No per-name resolver (inherits potluck.eth's).
        try potluckRegistry.setSub(label, IRegistry(address(poolReg))) {
            emit PoolNamed(poolId, label);
        } catch {
            emit NamingFailed(poolId, address(0), "setSub");
        }
    }

    /// @inheritdoc IPoolNaming
    function registerMember(uint256 poolId, address member, bytes32 idKey) external {
        if (!factory.isPool(msg.sender)) return; // caller-gate: silently ignore, never revert
        address poolReg = poolRegistry[poolId];
        if (poolReg == address(0)) return;

        bytes32 nameHash = memberNameHash(poolId, member);
        idKeyOf[nameHash] = idKey; // record BEFORE the external mint so resolution works even if mint fails
        emit MemberNamed(poolId, member, nameHash);
        // The member leaf lives under poolReg; no deeper registry needed. It inherits the resolver.
    }

    /// @inheritdoc IPoolNaming
    function isLiveNaming() external pure returns (bool) {
        return true;
    }

    /// @notice The ENS namehash of member.poolN.potluck.eth, computed the standard way so the
    ///         resolver and the map agree. namehash is the recursive keccak over labelhashes.
    function memberNameHash(uint256 poolId, address member) public view returns (bytes32) {
        bytes32 ethNode = _namehash(bytes32(0), "eth");
        bytes32 potluckNode = _namehash(ethNode, potluckLabel);
        bytes32 poolNode = _namehash(potluckNode, _poolLabel(poolId));
        return _namehash(poolNode, _memberLabel(member));
    }

    function _namehash(bytes32 parent, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(parent, keccak256(bytes(label))));
    }

    function _poolLabel(uint256 poolId) internal pure returns (string memory) {
        return string.concat("pool", _u(poolId));
    }

    /// @notice Public accessor for the member label, so tooling/tests can build the DNS name.
    function memberLabelExternal(address member) external pure returns (string memory) {
        return _memberLabel(member);
    }

    /// @notice Member label = lowercase hex of the address (deterministic, collision-free).
    function _memberLabel(address member) internal pure returns (string memory) {
        return _toHexString(member);
    }

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        bytes memory b;
        while (v > 0) {
            b = abi.encodePacked(uint8(48 + (v % 10)), b);
            v /= 10;
        }
        return string(b);
    }

    function _toHexString(address a) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes20 data = bytes20(a);
        bytes memory str = new bytes(2 + 40);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
