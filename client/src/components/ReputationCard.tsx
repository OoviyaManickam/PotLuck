'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { usePools } from '@/hooks/usePools';
import { usePool } from '@/hooks/usePool';
import { useReputation } from '@/hooks/useReputation';
import { shortAddr } from '@/lib/format';

/** Tier colours matched to Bronze/Silver/Gold/New. */
function tierColor(tier: number): string {
  switch (tier) {
    case 1: return 'bg-amber-700/30 text-amber-300 border-amber-700/40'; // Bronze
    case 2: return 'bg-slate-400/30 text-slate-200 border-slate-400/40'; // Silver
    case 3: return 'bg-yellow-400/30 text-yellow-200 border-yellow-500/40'; // Gold
    default: return 'bg-surface-2 text-text-muted border-surface-2'; // New
  }
}

function tierBarColor(tier: number): string {
  switch (tier) {
    case 1: return 'bg-amber-600';
    case 2: return 'bg-slate-400';
    case 3: return 'bg-yellow-400';
    default: return 'bg-surface-2';
  }
}

/** Fraction of the bar to fill (0–1) per tier level. */
function tierFraction(tier: number): number {
  const fractions = [0.08, 0.33, 0.66, 1.0];
  return fractions[Math.min(tier, 3)] ?? 0.08;
}

/**
 * Inner component: receives idKey already resolved from pool membership.
 */
function ReputationDisplay({ idKey }: { idKey: `0x${string}` }) {
  const rep = useReputation(idKey);

  if (rep.isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-5 w-24 rounded bg-surface-2" />
        <div className="h-2 w-full rounded bg-surface-2" />
      </div>
    );
  }

  const colorClasses = tierColor(rep.tier);
  const barColor = tierBarColor(rep.tier);
  const fraction = tierFraction(rep.tier);

  return (
    <div className="space-y-3">
      {/* Tier badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${colorClasses}`}
        >
          {rep.tierLabel}
        </span>
        {rep.hasDefaulted && (
          <span className="inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
            Defaulted
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span>
          <span className="font-semibold text-text">{rep.cleanCycles}</span> clean cycle{rep.cleanCycles !== 1 ? 's' : ''}
        </span>
        <span>
          {rep.hasDefaulted ? (
            <span className="text-orange-400">Has defaulted</span>
          ) : (
            <span className="text-green-400">No defaults</span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Probes a single pool for the connected wallet's membership.
 *
 * Calls usePool unconditionally (hooks-safe: this component always calls its
 * hooks at the top level regardless of prop values). When the pool loads and
 * the wallet is found as a member, calls onFound(idKey) via useEffect so the
 * parent can surface the resolved idKey. Renders null — all display logic
 * lives in the parent ReputationPoolScanner.
 */
function PoolMembershipProbe({
  poolAddress,
  walletAddress,
  onFound,
}: {
  poolAddress: `0x${string}`;
  walletAddress: `0x${string}`;
  onFound: (idKey: `0x${string}`) => void;
}) {
  const { pool, isLoading } = usePool(poolAddress);

  useEffect(() => {
    if (isLoading || !pool) return;

    // Primary membership signal: mySlotPlusOne > 0 means the connected wallet
    // is in this pool. Then locate the Member record to get its idKey.
    if (pool.mySlotPlusOne > 0n) {
      const member = pool.members.find(
        (m) => m.wallet.toLowerCase() === walletAddress.toLowerCase()
      );
      if (member) {
        onFound(member.idKey);
      }
    }
  }, [isLoading, pool, walletAddress, onFound]);

  // This component is probe-only; it renders nothing itself.
  return null;
}

/**
 * Renders one PoolMembershipProbe per pool (each calls usePool unconditionally
 * at its own top level — hooks-safe). Tracks the resolved idKey via state.
 * Shows ReputationDisplay once a match is found, a loading skeleton while any
 * pool is still loading, or the empty state when all pools resolve without a
 * match.
 */
function ReputationPoolScanner({
  pools,
  walletAddress,
}: {
  pools: Array<{ address: `0x${string}` }>;
  walletAddress: `0x${string}`;
}) {
  const [foundIdKey, setFoundIdKey] = useState<`0x${string}` | null>(null);

  // Stable callback — won't retrigger probes unnecessarily.
  // We use a closure that ignores repeat calls once an idKey is found.
  const handleFound = (idKey: `0x${string}`) => {
    setFoundIdKey((prev) => prev ?? idKey);
  };

  return (
    <>
      {/* Render one probe per pool; each calls usePool unconditionally. */}
      {pools.map((p) => (
        <PoolMembershipProbe
          key={p.address}
          poolAddress={p.address}
          walletAddress={walletAddress}
          onFound={handleFound}
        />
      ))}

      {/* Display layer — driven entirely by foundIdKey state. */}
      {foundIdKey ? (
        <ReputationDisplay idKey={foundIdKey} />
      ) : (
        <p className="text-sm text-text-muted">
          Join a pool to build your on-chain reputation.
        </p>
      )}
    </>
  );
}

/**
 * ReputationCard — shows the connected wallet's reputation tier, cleanCycles,
 * and default status.
 *
 * idKey is derived by scanning ALL real pools (not just index 0) and finding
 * the first one where the connected wallet is a member. One PoolMembershipProbe
 * subcomponent is rendered per pool; each calls usePool exactly once at its own
 * top level (hooks-safe). The empty state is shown only when the wallet is in
 * NO pool.
 */
export function ReputationCard() {
  const { address } = useAccount();
  const { pools, isLoading: poolsLoading } = usePools();

  if (!address) {
    return (
      <div className="rounded-2xl border border-surface-2 bg-surface p-6">
        <p className="text-sm text-text-muted">Connect your wallet to view reputation.</p>
      </div>
    );
  }

  if (poolsLoading) {
    return (
      <div className="rounded-2xl border border-surface-2 bg-surface p-6 animate-pulse space-y-3">
        <div className="h-5 w-28 rounded bg-surface-2" />
        <div className="h-2 w-full rounded bg-surface-2" />
      </div>
    );
  }

  // Filter to pools that actually exist (non-sample).
  const realPools = pools.filter((p) => !p.isSample);

  return (
    <div className="rounded-2xl border border-surface-2 bg-surface p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text">Reputation</h2>
        <p className="text-xs text-text-muted mt-0.5">{shortAddr(address)}</p>
      </div>

      {realPools.length === 0 ? (
        <p className="text-sm text-text-muted">
          Join a pool to build your on-chain reputation.
        </p>
      ) : (
        <ReputationPoolScanner
          pools={realPools}
          walletAddress={address}
        />
      )}
    </div>
  );
}
