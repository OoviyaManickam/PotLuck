import type { PoolSummary } from '@/lib/types';
import { PoolStatus } from '@/lib/types';

/**
 * Sample pools for UI development and empty-state fallback.
 * All entries have isSample: true — remove this entire array in one line
 * once real on-chain pools exist at scale.
 *
 * Addresses are clearly fake but structurally valid 0x-hex strings.
 */
export const SAMPLE_POOLS: PoolSummary[] = [
  {
    address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA01' as `0x${string}`,
    poolId: 1n,
    status: PoolStatus.OPEN,
    contribution: 10_000_000n, // 10 USDC
    memberCount: 5,
    memberCountJoined: 2n,
    currentRound: 0,
    isSample: true,
  },
  {
    address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA02' as `0x${string}`,
    poolId: 2n,
    status: PoolStatus.ROUND_ACTIVE,
    contribution: 50_000_000n, // 50 USDC
    memberCount: 4,
    memberCountJoined: 4n,
    currentRound: 2,
    isSample: true,
  },
];

/** Tier caps for client-side UX validation (New-tier is the conservative default). */
export const TIER_CAPS = {
  New:    { contribution: 25_000_000n, memberCount: 6 },
  Bronze: { contribution: 100_000_000n, memberCount: 10 },
  Silver: { contribution: 500_000_000n, memberCount: 12 },
  Gold:   { contribution: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'), memberCount: 255 },
} as const;

export const MIN_MEMBERS = 3;
