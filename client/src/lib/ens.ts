/**
 * ENS resolution utilities for PotLuck.
 *
 * Name scheme:
 *   member: <label>.pool<poolId>.potluck.eth
 *   pool:   pool<poolId>.potluck.eth
 *
 * <label> = lowercased hex address without 0x prefix
 * (matches the fork-test convention: <alicehex>.pool0.potluck.eth)
 *
 * CURRENT STATE: potluck.eth IS registered live on Sepolia, with PotLuck's
 * ReputationResolver attached at the potluck.eth node and the factory minting
 * pool<N>.potluck.eth for every new pool. resolveReputationViaEns returns the
 * live reputation text record for a member once that member's pool was created
 * under the live naming adapter; it still returns null gracefully for names that
 * don't exist yet (e.g. pools created before go-live, or an RPC hiccup), so
 * callers keep the registry-derived fallback.
 */

import { normalize } from 'viem/ens';
import type { PublicClient } from 'viem';

/**
 * UniversalResolverV2 on Sepolia.
 * Verified from on-chain fork test against this exact address.
 */
export const UNIVERSAL_RESOLVER_V2 =
  '0x4A1817d13E9cF196f471725176355C1234b63C70' as const;

/**
 * The text record key that PotLuck's ReputationResolver answers.
 * Returns a string like "cleanCycles=3;defaulted=false;tier=Silver"
 */
const REPUTATION_TEXT_KEY = 'potluck.reputation';

/**
 * Build the intended ENS name for a pool.
 * e.g. pool0.potluck.eth
 */
export function intendedPoolName(poolId: bigint | number): string {
  return `pool${poolId}.potluck.eth`;
}

/**
 * Build the intended ENS name for a pool member.
 * label should be the member's lowercase hex address without the 0x prefix
 * (e.g. "a1b2c3...") — this matches the fork-test convention.
 * e.g. a1b2c3....pool0.potluck.eth
 */
export function intendedMemberName(
  label: string,
  poolId: bigint | number
): string {
  return `${label}.pool${poolId}.potluck.eth`;
}

/**
 * Parse the potluck.reputation text record into structured fields.
 * Format: "cleanCycles=3;defaulted=false;tier=Silver"
 * Tolerates unknown keys and partial/empty input — returns raw string under
 * the `raw` field when parsing fails completely.
 */
export function parseReputationText(s: string): {
  cleanCycles?: number;
  defaulted?: boolean;
  tier?: string;
  raw?: string;
} {
  if (!s) return {};

  try {
    const parts = s.split(';').filter(Boolean);
    const result: { cleanCycles?: number; defaulted?: boolean; tier?: string; raw?: string } = {};

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();

      if (key === 'cleanCycles') {
        const n = parseInt(val, 10);
        if (!isNaN(n)) result.cleanCycles = n;
      } else if (key === 'defaulted') {
        result.defaulted = val === 'true';
      } else if (key === 'tier') {
        result.tier = val;
      }
    }

    // If nothing was parsed, expose the raw string for display
    if (
      result.cleanCycles === undefined &&
      result.defaulted === undefined &&
      result.tier === undefined
    ) {
      result.raw = s;
    }

    return result;
  } catch {
    return { raw: s };
  }
}

/**
 * Resolve the potluck.reputation text record for a given ENS name.
 *
 * Uses viem's getEnsText against UniversalResolverV2 on Sepolia.
 * The public client carries the transport (Alchemy RPC from env — no hardcoded RPC here).
 *
 * Returns the raw reputation string if resolved, null otherwise.
 * null means: the name doesn't exist yet (pool created before go-live, or member
 * not yet minted), resolver reverted, or any network/RPC error. Callers should
 * show the registry fallback when null is returned.
 *
 * NEVER throws — all errors are caught and converted to null.
 */
export async function resolveReputationViaEns(
  client: PublicClient,
  name: string
): Promise<string | null> {
  try {
    // normalize() validates and normalises the ENS name (ENSIP-15).
    // Throws if the name is invalid — caught below → null.
    const normalizedName = normalize(name);

    const text = await client.getEnsText({
      name: normalizedName,
      key: REPUTATION_TEXT_KEY,
      universalResolverAddress: UNIVERSAL_RESOLVER_V2,
    });

    if (!text) return null;
    return text;
  } catch {
    // Name not minted yet, resolver revert, or network error — all safe.
    return null;
  }
}
