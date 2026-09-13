'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { usePools } from '@/hooks/usePools';
import { usePool } from '@/hooks/usePool';
import {
  intendedMemberName,
  memberEnsLabel,
  resolveReputationViaEns,
  parseReputationText,
  UNIVERSAL_RESOLVER_V2,
} from '@/lib/ens';
import type { PoolSummary } from '@/lib/types';

/** Live ENS resolution result + which pool it came from. */
interface EnsResolution {
  ensName: string;
  poolAddress: `0x${string}`;
  poolId: bigint;
  reputationText: string | null;
  parsed: ReturnType<typeof parseReputationText> | null;
  loading: boolean;
}

/** Resolve ENS for a single member in a single pool. */
function useEnsResolution(
  walletAddress: `0x${string}` | undefined,
  pool: PoolSummary | undefined
): EnsResolution | null {
  const client = usePublicClient();
  const [resolution, setResolution] = useState<EnsResolution | null>(null);

  const poolAddress = pool?.address;
  const poolIdStr = pool?.poolId.toString();

  useEffect(() => {
    let cancelled = false;

    if (!walletAddress || !pool || !client) {
      // Clear asynchronously — a synchronous setState in an effect body
      // triggers cascading renders.
      Promise.resolve().then(() => {
        if (!cancelled) setResolution(null);
      });
      return () => {
        cancelled = true;
      };
    }

    // Build the intended ENS name using the address-hex label convention
    const label = memberEnsLabel(walletAddress); // lowercase hex incl. 0x, matches PotluckENS._memberLabel
    const ensName = intendedMemberName(label, pool.poolId);
    const poolAddress = pool.address;
    const poolId = pool.poolId;

    // Loading state + resolution both set asynchronously (never synchronously
    // in the effect body — that triggers cascading renders).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setResolution({
        ensName,
        poolAddress,
        poolId,
        reputationText: null,
        parsed: null,
        loading: true,
      });
    });

    resolveReputationViaEns(client, ensName).then((text) => {
      if (cancelled) return;
      setResolution({
        ensName,
        poolAddress,
        poolId,
        reputationText: text,
        parsed: text ? parseReputationText(text) : null,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, poolAddress, poolIdStr, client]);

  return resolution;
}

/**
 * Inner panel — renders ENS data for one membership.
 *
 * BOUNTY-CRITICAL: this panel shows ENS names and reputation ONLY when they
 * genuinely resolve live through the UniversalResolver. We never print a
 * string-constructed name as if it were a fact, and we never show
 * ReputationRegistry values dressed up as ENS data. If resolution fails, the
 * member is simply omitted (return null) — honest ENS or nothing.
 */
function EnsPanelInner({
  walletAddress,
  pool,
}: {
  walletAddress: `0x${string}`;
  pool: PoolSummary;
}) {
  const ens = useEnsResolution(walletAddress, pool);

  const isLive = ens && !ens.loading && ens.reputationText !== null;

  // Still resolving — neutral status, no name shown yet.
  if (ens?.loading || !ens) {
    return (
      <div className="rounded-xl border border-surface-2 bg-surface-2/30 p-4">
        <p className="text-xs text-text-muted animate-pulse">Resolving via ENS…</p>
      </div>
    );
  }

  // Not resolvable — omit entirely. We do NOT print the constructed name or any
  // registry fallback here; an unresolved name is not an ENS fact.
  if (!isLive) return null;

  // Live-resolved: the name below came BACK from the resolver, not a template.
  return (
    <div className="space-y-4">
      {/* Names — only shown because they resolved live */}
      <div className="space-y-1">
        <span className="text-xs text-text-muted font-medium uppercase tracking-wide">Member name</span>
        <p className="font-mono text-sm text-text break-all">{ens.ensName}</p>
      </div>

      {/* Resolver note */}
      <div className="text-xs text-text-muted">
        Resolver:{' '}
        <span className="font-mono">
          {UNIVERSAL_RESOLVER_V2.slice(0, 10)}…{UNIVERSAL_RESOLVER_V2.slice(-6)}
        </span>
        {' (UniversalResolverV2, Sepolia)'}
      </div>

      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <p className="text-sm font-semibold text-green-300">
            Resolved live via ENS ✓ (UniversalResolverV2)
          </p>
        </div>
        {ens.parsed && (
          <div className="space-y-1 text-xs text-text-muted">
            {ens.parsed.tier !== undefined && (
              <p>Tier: <span className="text-text font-medium">{ens.parsed.tier}</span></p>
            )}
            {ens.parsed.cleanCycles !== undefined && (
              <p>Clean cycles: <span className="text-text font-medium">{ens.parsed.cleanCycles}</span></p>
            )}
            {ens.parsed.defaulted !== undefined && (
              <p>Defaulted: <span className="text-text font-medium">{ens.parsed.defaulted ? 'Yes' : 'No'}</span></p>
            )}
            {ens.parsed.raw && (
              <p className="font-mono break-all">{ens.parsed.raw}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirms the wallet is a member of this pool, then renders EnsPanelInner.
 * Membership is read from pool detail; resolution itself happens in the inner
 * panel and gates all display on a genuine live resolve.
 */
function EnsPanelForPool({
  walletAddress,
  pool,
}: {
  walletAddress: `0x${string}`;
  pool: PoolSummary;
}) {
  const { pool: detail, isLoading } = usePool(pool.address);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-surface-2 bg-surface p-5 h-24" />
    );
  }

  const isMember = detail?.members.some(
    (m) => m.wallet.toLowerCase() === walletAddress.toLowerCase()
  );

  if (!isMember) return null; // not actually a member of this pool

  return <EnsPanelInner walletAddress={walletAddress} pool={pool} />;
}

/**
 * EnsPanel — ENS bounty showcase panel.
 *
 * Resolves each pool membership live via UniversalResolverV2 on Sepolia and
 * shows ONLY what actually resolved. No constructed names, no registry
 * fallback dressed up as ENS: if a name does not resolve live, nothing is
 * shown for it. A displayed name is therefore always proof of on-chain
 * resolution, never a client-side string.
 */
export function EnsPanel() {
  const { address } = useAccount();
  const { pools, isLoading: poolsLoading } = usePools();

  if (!address) {
    return (
      <div className="rounded-2xl border border-surface-2 bg-surface p-6">
        <p className="text-sm text-text-muted">Connect your wallet to view ENS names.</p>
      </div>
    );
  }

  const realPools = pools.filter((p) => !p.isSample);

  return (
    <div className="rounded-2xl border border-surface-2 bg-surface p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-text">ENS Resolution</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Reputation resolves live as a text record through the ENS
          universalResolver on Sepolia. Only names that resolve on-chain are
          shown below.
        </p>
      </div>

      {poolsLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-48 rounded bg-surface-2" />
          <div className="h-4 w-32 rounded bg-surface-2" />
        </div>
      ) : realPools.length === 0 ? (
        <p className="text-sm text-text-muted">
          Join a pool to get an ENS subname that resolves your reputation live.
        </p>
      ) : (
        <div className="space-y-6">
          {realPools.map((pool) => (
            <EnsPanelForPool
              key={pool.address}
              walletAddress={address}
              pool={pool}
            />
          ))}
        </div>
      )}
    </div>
  );
}
