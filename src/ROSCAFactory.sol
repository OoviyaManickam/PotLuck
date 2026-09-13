// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ROSCAPool} from "./ROSCAPool.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {IIdentityGate} from "./interfaces/IIdentityGate.sol";
import {IPoolNaming} from "./interfaces/IPoolNaming.sol";
import {Tiers} from "./Tiers.sol";

/// @title ROSCAFactory
/// @notice Deploys ROSCAPool instances, enforces the protocol-wide member floor and the
///         creator's reputation tier caps at creation, and authorises each new pool to
///         write to the ReputationRegistry. Spec §4.
/// @dev Deployment order breaks the factory<->registry cycle: deploy factory, deploy
///      registry pointing at the factory, then call `setRegistry` once.
///      Q3 locked: the creator is NOT auto-enrolled here — they call pool.join() on the
///      same path as everyone else.
contract ROSCAFactory {
    using Tiers for Tiers.Tier;

    struct PoolConfig {
        uint256 contribution; // per member, per round
        uint8 memberCount; // N (>= MIN_MEMBERS)
        uint32 periodSeconds;
        uint32 windowSeconds;
        uint8 minScore; // min cleanCycles to join (open pools)
        bool acceptDefaulted; // whether hasDefaulted members may join
        bool inviteOnly; // Trust Circle vs open pool
    }

    address public immutable token;
    IIdentityGate public identityGate; // swappable by owner (NoOp -> WorldID)
    IPoolNaming public naming; // swappable by owner (NoOp -> PotluckENS)
    address public immutable treasury;
    address public owner;

    ReputationRegistry public registry;
    bool private registrySet;

    address[] public allPools;
    mapping(address => bool) public isPool;

    event RegistrySet(address indexed registry);
    event IdentityGateSet(address indexed gate);
    event NamingSet(address indexed naming);
    event PoolCreated(address indexed pool, address indexed creator, uint256 poolId, PoolConfig config);

    error NotOwner();
    error RegistryAlreadySet();
    error RegistryNotSet();
    error BelowMinMembers();
    error ExceedsCreatorTier();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address token_, address identityGate_, address naming_, address treasury_) {
        token = token_;
        identityGate = IIdentityGate(identityGate_);
        naming = IPoolNaming(naming_);
        treasury = treasury_;
        owner = msg.sender;
    }

    /// @notice Wire the registry once, after it has been deployed pointing at this factory.
    function setRegistry(address registry_) external onlyOwner {
        if (registrySet) revert RegistryAlreadySet();
        registry = ReputationRegistry(registry_);
        registrySet = true;
        emit RegistrySet(registry_);
    }

    /// @notice Swap the identity gate (e.g. NoOpGate -> WorldIDGate). Affects pools created after.
    function setIdentityGate(address gate_) external onlyOwner {
        identityGate = IIdentityGate(gate_);
        emit IdentityGateSet(gate_);
    }

    /// @notice Swap the naming adapter (e.g. NoOpNaming -> PotluckENS). Affects pools created after.
    function setNaming(address naming_) external onlyOwner {
        naming = IPoolNaming(naming_);
        emit NamingSet(naming_);
    }

    /// @notice Create a new pool. Enforces the member floor and the creator's tier caps.
    /// @param cfg pool parameters
    /// @param creatorProof identity proof for the creator (checked to derive their tier)
    function createPool(PoolConfig calldata cfg, bytes calldata creatorProof) external returns (address pool) {
        if (!registrySet) revert RegistryNotSet();
        if (cfg.memberCount < Tiers.MIN_MEMBERS) revert BelowMinMembers();

        // Verify the creator's identity and enforce their tier caps on the pool size.
        bytes32 creatorIdKey = identityGate.verifyJoin(msg.sender, allPools.length, creatorProof);
        Tiers.Tier t = registry.tierOf(creatorIdKey);
        if (cfg.contribution > t.maxContribution() || cfg.memberCount > t.maxMembers()) {
            revert ExceedsCreatorTier();
        }

        uint256 poolId = allPools.length;
        ROSCAPool.InitParams memory p = ROSCAPool.InitParams({
            poolId: poolId,
            creator: msg.sender,
            token: token,
            identityGate: address(identityGate),
            reputation: address(registry),
            treasury: treasury,
            contribution: cfg.contribution,
            memberCount: cfg.memberCount,
            periodSeconds: cfg.periodSeconds,
            windowSeconds: cfg.windowSeconds,
            minScore: cfg.minScore,
            acceptDefaulted: cfg.acceptDefaulted,
            inviteOnly: cfg.inviteOnly
        });

        pool = address(new ROSCAPool(p));
        allPools.push(pool);
        isPool[pool] = true;
        registry.authorizePool(pool);
        naming.registerPool(poolId);

        emit PoolCreated(pool, msg.sender, poolId, cfg);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }
}
