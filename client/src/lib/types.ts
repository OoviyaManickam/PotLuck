/**
 * Shared domain types for PotLuck pool data.
 */

/** Mirror of the ROSCAPool.Status enum (uint8). */
export enum PoolStatus {
  OPEN = 0,
  LOCKED = 1,
  ROUND_ACTIVE = 2,
  COMPLETE = 3,
  CANCELLED = 4,
}

/** Mirrors ROSCAPool.Member struct returned by getMember(slot). */
export interface Member {
  wallet: `0x${string}`;
  idKey: `0x${string}`;
  collateral: bigint;
  hasReceivedPot: boolean;
  active: boolean;
  defaultedThisCycle: boolean;
}

/**
 * Summary view of a pool — returned by usePools().
 * isSample is optional; set to true by Task 7 sample-card injection.
 */
export interface PoolSummary {
  address: `0x${string}`;
  poolId: bigint;
  status: PoolStatus;
  contribution: bigint;
  memberCount: number;
  memberCountJoined: bigint;
  currentRound: number;
  isSample?: boolean;
}

/** Full detail view of a pool — returned by usePool(address). */
export interface PoolDetail extends PoolSummary {
  pot: bigint;
  roundEndsAt: bigint;
  windowEndsAt: bigint;
  payoutOrder: readonly number[];
  creator: `0x${string}`;
  members: Member[];
  /** slotOfPlusOne(connectedWallet) — 0 if not a member. */
  mySlotPlusOne: bigint;
  /** True if the connected wallet already paid this round (only meaningful when ROUND_ACTIVE and mySlotPlusOne > 0). */
  iPaidThisRound: boolean;
}
