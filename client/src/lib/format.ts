import { formatUnits, parseUnits } from "viem";

/**
 * Format a USDC amount from 6-decimal bigint to a human-readable string.
 * e.g. formatUsdc(100_000_000n) === "100"
 */
export function formatUsdc(v: bigint): string {
  return formatUnits(v, 6);
}

/**
 * Parse a human-readable USDC string to a 6-decimal bigint.
 * e.g. parseUsdc("100") === 100_000_000n
 */
export function parseUsdc(x: string): bigint {
  return parseUnits(x, 6);
}

/**
 * Returns the tier name for a numeric tier level.
 * Order matches src/Tiers.sol: 0=New, 1=Bronze, 2=Silver, 3=Gold.
 */
const TIER_NAMES = ["New", "Bronze", "Silver", "Gold"] as const;

export function tierName(n: number): string {
  return TIER_NAMES[n] ?? `Tier${n}`;
}

/**
 * Returns the human-readable pool status name.
 * Order matches ROSCAPool Status enum:
 * 0=OPEN, 1=LOCKED, 2=ROUND_ACTIVE, 3=COMPLETE, 4=CANCELLED
 */
const STATUS_NAMES = [
  "OPEN",
  "LOCKED",
  "ROUND_ACTIVE",
  "COMPLETE",
  "CANCELLED",
] as const;

export function statusName(n: number): string {
  return STATUS_NAMES[n] ?? `STATUS_${n}`;
}

/**
 * Returns a shortened ethereum address: 0x1234…abcd
 */
export function shortAddr(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
