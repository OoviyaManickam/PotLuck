'use client';

import { isAddress } from 'viem';
import { useReadContract } from 'wagmi';
import { usePool } from '@/hooks/usePool';
import { PoolState } from '@/components/PoolState';
import { MemberRow } from '@/components/MemberRow';
import { PoolActions } from '@/components/PoolActions';
import { ActivityFeed } from '@/components/ActivityFeed';
import { PillButton } from '@/components/PillButton';
import { shortAddr } from '@/lib/format';
import { intendedPoolName } from '@/lib/ens';
import { ADDRESSES } from '@/lib/contracts';
import { factoryAbi } from '@/lib/abis/factory';

interface Props {
  address: string;
}

export default function PoolDetailClient({ address }: Props) {
  // Validate address shape first
  if (!isAddress(address)) {
    return <PoolNotFound reason="Invalid address format." />;
  }

  const poolAddr = address as `0x${string}`;

  return <PoolDetailInner poolAddr={poolAddr} />;
}

function PoolDetailInner({ poolAddr }: { poolAddr: `0x${string}` }) {
  // Validate it's a real pool via factory.isPool
  const { data: isPoolValid, isLoading: isPoolCheckLoading } = useReadContract({
    address: ADDRESSES.factory,
    abi: factoryAbi,
    functionName: 'isPool',
    args: [poolAddr],
  });

  const { pool, isLoading, refetch } = usePool(poolAddr);

  if (isPoolCheckLoading) {
    return (
      <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full">
        <div className="h-8 w-64 bg-surface-2 rounded-xl animate-pulse mb-4" />
        <div className="h-48 bg-surface-2 rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (isPoolValid === false) {
    return <PoolNotFound reason="This address is not a PotLuck pool." />;
  }

  if (isLoading && !pool) {
    return (
      <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
        <div className="h-8 w-64 bg-surface-2 rounded-xl animate-pulse" />
        <div className="h-48 bg-surface-2 rounded-2xl animate-pulse" />
        <div className="h-48 bg-surface-2 rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (!pool) {
    return <PoolNotFound reason="Pool data could not be loaded." />;
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <PillButton variant="ghost" href="/pools" className="!px-3 !py-1.5 !text-xs">
          ← Pools
        </PillButton>
        <div>
          <h1 className="text-xl font-bold text-text">Pool {String(pool.poolId)}</h1>
          <p className="text-xs text-text-muted mt-0.5 font-mono">{shortAddr(poolAddr)}</p>
          {/* Frame the pool<N> subdomain as a deliberate, auto-assigned ENS
              naming scheme rather than an unnamed pool. */}
          <p className="text-xs text-text-muted mt-1">
            🏷 ENS:{' '}
            <span className="font-mono text-text">{intendedPoolName(pool.poolId)}</span>{' '}
            — canonical subdomain, auto-assigned at creation
          </p>
        </div>
      </div>

      {/* Pool overview */}
      <PoolState pool={pool} />

      {/* Actions */}
      <PoolActions pool={pool} poolAddr={poolAddr} refetch={refetch} />

      {/* Members list */}
      {pool.members.length > 0 && (
        <section className="rounded-2xl border border-surface-2 bg-surface p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-text">
            Members ({pool.members.length})
          </h2>
          <div className="flex flex-col gap-2">
            {pool.members.map((member, slot) => (
              <MemberRow
                key={member.wallet}
                member={member}
                slot={slot}
                poolId={pool.poolId}
                isMe={pool.mySlotPlusOne > 0n && slot === Number(pool.mySlotPlusOne - 1n)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Activity feed */}
      <ActivityFeed poolAddr={poolAddr} />
    </main>
  );
}

function PoolNotFound({ reason }: { reason: string }) {
  return (
    <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full flex flex-col items-center justify-center gap-4">
      <p className="text-xl font-bold text-text">Pool not found</p>
      <p className="text-sm text-text-muted">{reason}</p>
      <PillButton variant="accent" href="/pools">
        Back to Pools
      </PillButton>
    </main>
  );
}
