'use client';

import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { usePools } from '@/hooks/usePools';
import { usePool } from '@/hooks/usePool';
import { ReputationCard } from '@/components/ReputationCard';
import { EnsPanel } from '@/components/EnsPanel';
import { PoolCard } from '@/components/PoolCard';
import { PillButton } from '@/components/PillButton';
import { shortAddr } from '@/lib/format';
import type { PoolSummary } from '@/lib/types';

/**
 * Shows the pools the connected wallet is actually a member of.
 * We must read pool detail to know membership — one usePool per pool.
 */
function MemberPoolCard({
  pool,
  walletAddress,
}: {
  pool: PoolSummary;
  walletAddress: `0x${string}`;
}) {
  const { pool: detail, isLoading } = usePool(pool.address);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-surface-2 bg-surface p-5 h-28 animate-pulse" />
    );
  }

  const isMember = detail?.members.some(
    (m) => m.wallet.toLowerCase() === walletAddress.toLowerCase()
  );

  if (!isMember) return null;

  return <PoolCard pool={pool} />;
}

export default function ProfilePageClient() {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { pools, isLoading: poolsLoading } = usePools();

  // Not-connected state
  if (!ready || !authenticated || !address) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-16">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-text">Your Profile</h1>
          <p className="text-sm text-text-muted">
            Connect your wallet to view your reputation and ENS names.
          </p>
        </div>
        {ready && (
          <PillButton variant="accent" onClick={() => login()}>
            Connect Wallet
          </PillButton>
        )}
      </main>
    );
  }

  const realPools = pools.filter((p) => !p.isSample);

  return (
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Your Profile</h1>
        <p className="text-sm text-text-muted font-mono mt-1">{shortAddr(address)}</p>
      </div>

      {/* Reputation card */}
      <ReputationCard />

      {/* ENS showcase panel */}
      <EnsPanel />

      {/* My pools */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text">My Pools</h2>

        {poolsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-surface-2 bg-surface p-5 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : realPools.length === 0 ? (
          <p className="text-sm text-text-muted">
            You are not a member of any pool yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {realPools.map((pool) => (
              <MemberPoolCard
                key={pool.address}
                pool={pool}
                walletAddress={address}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
