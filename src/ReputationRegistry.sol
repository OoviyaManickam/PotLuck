// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Tiers} from "./Tiers.sol";

/// @title ReputationRegistry
/// @notice The only cross-pool, long-lived state in PotLuck. A permanent record keyed by
///         identity (`idKey` from IIdentityGate): how many cycles a human has completed
///         cleanly, and whether they have ever defaulted.
/// @dev Spec §3. Pools write outcomes (access-controlled); anyone can read. Tiers are
///      derived from the clean-cycle count via the Tiers library.
///
///      Design decisions locked (spec §10):
///      - Q1: idKey is stable per human (single app-wide World ID action), so reputation
///        is genuinely cross-pool and can't be shed by switching wallets.
///      - Q2: a default sets a permanent flag but does NOT freeze cleanCycles — the count
///        stays an honest record of real history.
contract ReputationRegistry {
    struct Record {
        uint32 cleanCycles; // completed cycles with no default — the "score"
        bool hasDefaulted; // permanent flag, never cleared
        bool exists;
    }

    /// @notice idKey => reputation record.
    mapping(bytes32 => Record) public records;

    /// @notice Pools authorised to write outcomes. Set by the factory at pool creation.
    mapping(address => bool) public authorizedPools;

    /// @notice The factory allowed to authorise pools. Set once at construction.
    address public immutable factory;

    event PoolAuthorized(address indexed pool);
    event ReputationUpdated(bytes32 indexed idKey, uint32 cleanCycles, bool hasDefaulted);

    error NotFactory();
    error NotAuthorizedPool();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    modifier onlyAuthorizedPool() {
        if (!authorizedPools[msg.sender]) revert NotAuthorizedPool();
        _;
    }

    /// @param factory_ the ROSCAFactory that will authorise pools. If deployed before the
    ///        factory exists, pass the known/counterfactual factory address.
    constructor(address factory_) {
        factory = factory_;
    }

    // ---------------------------------------------------------------------
    // Reads (open)
    // ---------------------------------------------------------------------

    function cleanCycles(bytes32 idKey) external view returns (uint32) {
        return records[idKey].cleanCycles;
    }

    function hasDefaulted(bytes32 idKey) external view returns (bool) {
        return records[idKey].hasDefaulted;
    }

    /// @notice The reputation tier for an identity, derived from its clean-cycle count.
    function tierOf(bytes32 idKey) external view returns (Tiers.Tier) {
        return Tiers.tierOf(records[idKey].cleanCycles);
    }

    // ---------------------------------------------------------------------
    // Writes (only authorised pools)
    // ---------------------------------------------------------------------

    /// @notice Record that `idKey` completed a cycle with no default. Increments the score.
    function recordCleanCycle(bytes32 idKey) external onlyAuthorizedPool {
        Record storage r = records[idKey];
        r.exists = true;
        r.cleanCycles += 1;
        emit ReputationUpdated(idKey, r.cleanCycles, r.hasDefaulted);
    }

    /// @notice Record that `idKey` defaulted. Sets the permanent flag; count is untouched (Q2).
    function recordDefault(bytes32 idKey) external onlyAuthorizedPool {
        Record storage r = records[idKey];
        r.exists = true;
        r.hasDefaulted = true;
        emit ReputationUpdated(idKey, r.cleanCycles, r.hasDefaulted);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Authorise a pool (deployed by the factory) to write reputation outcomes.
    function authorizePool(address pool) external onlyFactory {
        authorizedPools[pool] = true;
        emit PoolAuthorized(pool);
    }
}
