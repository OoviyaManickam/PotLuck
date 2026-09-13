'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { usePools } from '@/hooks/usePools';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { PoolCard } from '@/components/PoolCard';
import { CreatePoolForm } from '@/components/CreatePoolForm';
import { MintUsdcButton } from '@/components/MintUsdcButton';
import { PillButton } from '@/components/PillButton';
import { SAMPLE_POOLS } from '@/lib/sampleData';

export default function PoolsPageClient() {
  const { address } = useAccount();
  const { pools, isLoading, refetch } = usePools();
  const { formatted: usdcFormatted } = useUsdcBalance(address);
  const [showForm, setShowForm] = useState(false);

  // Carried finding: after a successful createPool tx, explicitly call refetch()
  // so the new pool appears even if the WebSocket event watcher dropped silently.
  function handlePoolCreated() {
    refetch();
    setShowForm(false);
  }

  const allCards = [
    ...pools,
    ...SAMPLE_POOLS,
  ];

  return (
    <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex flex-col gap-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text">Pools</h1>
          <p className="text-sm text-text-muted mt-0.5">Browse active ROSCAs or start your own.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* USDC balance */}
          {address && (
            <span className="text-sm text-text-muted border border-surface-2 rounded-full px-4 py-2">
              {usdcFormatted} mUSDC
            </span>
          )}
          <MintUsdcButton />

          {/* Manual refresh — safeguard against dropped WS event */}
          <PillButton
            variant="ghost"
            onClick={refetch}
            disabled={isLoading}
          >
            {isLoading ? 'Loading…' : 'Refresh'}
          </PillButton>

          <PillButton
            variant="accent"
            withArrow={!showForm}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancel' : 'New Pool'}
          </PillButton>
        </div>
      </div>

      {/* Create pool form (collapsible inline section) */}
      {showForm && (
        <section className="rounded-2xl border border-surface-2 bg-surface p-6">
          <h2 className="text-base font-semibold text-text mb-5">Create a Pool</h2>
          <CreatePoolForm onSuccess={handlePoolCreated} />
        </section>
      )}

      {/* Pool grid */}
      {isLoading && pools.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Skeleton placeholders */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-2 bg-surface p-5 h-36 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {allCards.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-16">
              No pools found. Be the first to create one!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCards.map((pool) => (
                <PoolCard
                  key={pool.isSample ? `sample-${pool.poolId}` : pool.address}
                  pool={pool}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
