// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Tiers
/// @notice Reputation tiers and their pool-size caps (the anti-sybil ceiling).
///         Derived purely from a member's clean-cycle count. Single source of truth for
///         the caps enforced in ROSCAFactory.createPool and ROSCAPool.join (spec §3/§4/§5).
/// @dev Amounts are in the contribution token's base units. Token is MockUSDC (6 decimals),
///      so 25e6 = $25. Gold is uncapped.
library Tiers {
    enum Tier {
        New, // 0 clean cycles
        Bronze, // 1-2
        Silver, // 3-5
        Gold // 6+

    }

    /// @notice Map a clean-cycle count to a tier.
    function tierOf(uint32 cleanCycles) internal pure returns (Tier) {
        if (cleanCycles == 0) return Tier.New;
        if (cleanCycles <= 2) return Tier.Bronze;
        if (cleanCycles <= 5) return Tier.Silver;
        return Tier.Gold;
    }

    /// @notice Max per-round contribution allowed at a tier (base units).
    function maxContribution(Tier t) internal pure returns (uint256) {
        if (t == Tier.New) return 25e6;
        if (t == Tier.Bronze) return 100e6;
        if (t == Tier.Silver) return 500e6;
        return type(uint256).max; // Gold: no cap
    }

    /// @notice Max member count allowed at a tier.
    function maxMembers(Tier t) internal pure returns (uint256) {
        if (t == Tier.New) return 6;
        if (t == Tier.Bronze) return 10;
        if (t == Tier.Silver) return 12;
        return type(uint256).max; // Gold: no cap
    }

    /// @notice Protocol-wide minimum pool size. Below 3, a ROSCA is meaningless.
    uint8 internal constant MIN_MEMBERS = 3;
}
