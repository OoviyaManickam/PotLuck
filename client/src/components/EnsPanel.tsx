'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { usePools } from '@/hooks/usePools';
import { usePool } from '@/hooks/usePool';
import { useReputation } from '@/hooks/useReputation';
import {
  intendedMemberName,
  intendedPoolName,
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
  pool: PoolSummary | undefined,
  idKey: `0x${string}` | undefined
): EnsResolution | null {
  const client = usePublicClient();
  const [resolution, setResolution] = useState<EnsResolution | null>(null);

  useEffect(() => {
    if (!walletAddress || !pool || !client) return;

    // Build the intended ENS name using the address-hex label convention
    const label = memberEnsLabel(walletAddress); // lowercase hex incl. 0x, matches PotluckENS._memberLabel
    const ensName = intendedMemberName(label, pool.poolId);

    setResolution({
      ensName,
      poolAddress: pool.address,
      poolId: pool.poolId,
      reputationText: null,
      parsed: null,
      loading: true,
    });

    let cancelled = false;

    resolveReputationViaEns(client, ensName).then((text) => {
      if (cancelled) return;
      setResolution({
        ensName,
        poolAddress: pool.address,
        poolId: pool.poolId,
        reputationText: text,
        parsed: text ? parseReputationText(text) : null,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, pool?.address, pool?.poolId.toString(), client]);

  return resolution;
}

/**
 * Inner panel that needs idKey (from member data) + the pool.
 */
function EnsPanelInner({
  walletAddress,
  pool,
  idKey,
}: {
  walletAddress: `0x${string}`;
  pool: PoolSummary;
  idKey: `0x${string}`;
}) {
  const rep = useReputation(idKey);
  const ens = useEnsResolution(walletAddress, pool, idKey);
  const poolEnsName = intendedPoolName(pool.poolId);
  const memberEnsName = ens?.ensName ?? intendedMemberName(memberEnsLabel(walletAddress), pool.poolId);

  const isLive = ens && !ens.loading && ens.reputationText !== null;
  const isFallback = !ens?.loading && !isLive;

  return (
    <div className="space-y-4">
      {/* Names */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wide">Member name</span>
        </div>
        <p className="font-mono text-sm text-text break-all">{memberEnsName}</p>
        <p className="font-mono text-xs text-text-muted break-all">{poolEnsName}</p>
      </div>

      {/* Resolver note */}
      <div className="text-xs text-text-muted">
        Resolver:{' '}
        <span className="font-mono">
          {UNIVERSAL_RESOLVER_V2.slice(0, 10)}…{UNIVERSAL_RESOLVER_V2.slice(-6)}
        </span>
        {' (UniversalResolverV2, Sepolia)'}
      </div>

      {/* Resolution status */}
      {ens?.loading && (
        <div className="rounded-xl border border-surface-2 bg-surface-2/30 p-4">
          <p className="text-xs text-text-muted animate-pulse">Attempting ENS resolution…</p>
        </div>
      )}

      {isLive && ens && (
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
      )}

      {isFallback && (
        <div className="rounded-xl border border-surface-2 bg-surface-2/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <p className="text-xs text-yellow-300 font-medium">
              ENS name not minted yet — resolves live once this pool is created under the live adapter
            </p>
          </div>
          <p className="text-xs text-text-muted">
            Showing on-chain registry value (ReputationRegistry contract):
          </p>
          {rep.isLoading ? (
            <div className="animate-pulse h-4 w-32 rounded bg-surface-2" />
          ) : (
            <div className="space-y-1 text-xs text-text-muted">
              <p>Tier: <span className="text-text font-medium">{rep.tierLabel}</span></p>
              <p>Clean cycles: <span className="text-text font-medium">{rep.cleanCycles}</span></p>
              <p>Defaulted: <span className="text-text font-medium">{rep.hasDefaulted ? 'Yes' : 'No'}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Loads pool detail to extract the user's member idKey, then renders EnsPanelInner.
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

  const member = detail?.members.find(
    (m) => m.wallet.toLowerCase() === walletAddress.toLowerCase()
  );

  if (!member) return null; // not actually a member of this pool

  return (
    <EnsPanelInner
      walletAddress={walletAddress}
      pool={pool}
      idKey={member.idKey}
    />
  );
}

/**
 * EnsPanel — ENS bounty showcase panel.
 *
 * Shows the user's intended ENS name(s) and attempts live resolution via
 * UniversalResolverV2 on Sepolia.
 *
 * Live state: returns resolved reputation text → shows "Resolved live via ENS ✓"
 * Fallback state (name not minted yet — pool created before go-live, or RPC hiccup):
 * returns null → shows the on-chain ReputationRegistry value instead.
 *
 * The live-vs-fallback distinction is the ENS bounty narrative.
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
          PotLuck members get deterministic ENS subnames under potluck.eth.
          Reputation data resolves as a text record via ENS universalResolver.
        </p>
      </div>

      {poolsLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-48 rounded bg-surface-2" />
          <div className="h-4 w-32 rounded bg-surface-2" />
        </div>
      ) : realPools.length === 0 ? (
        <p className="text-sm text-text-muted">
          Join a pool to get an ENS subname under potluck.eth.
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
