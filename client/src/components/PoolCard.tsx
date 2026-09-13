'use client';

import Link from 'next/link';
import type { PoolSummary } from '@/lib/types';
import { PoolStatus } from '@/lib/types';
import { formatUsdc, statusName } from '@/lib/format';

interface PoolCardProps {
  pool: PoolSummary;
}

const STATUS_COLORS: Record<PoolStatus, string> = {
  [PoolStatus.OPEN]:         'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  [PoolStatus.LOCKED]:       'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  [PoolStatus.ROUND_ACTIVE]: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  [PoolStatus.COMPLETE]:     'bg-surface-2 text-text-muted border-surface-2',
  [PoolStatus.CANCELLED]:    'bg-red-500/20 text-red-300 border-red-500/30',
};

function CardContent({ pool }: { pool: PoolSummary }) {
  const ensLabel = `pool${pool.poolId}.potluck.eth`;
  const statusColor = STATUS_COLORS[pool.status] ?? STATUS_COLORS[PoolStatus.OPEN];

  return (
    <div className="group relative rounded-2xl border border-surface-2 bg-surface p-5 flex flex-col gap-3 transition-colors hover:border-accent/40 hover:bg-surface-2">
      {/* Top row: ENS label + badges */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-text-muted font-mono truncate">{ensLabel}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {pool.isSample && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-text-muted border border-surface-2 uppercase tracking-wide">
              Sample
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${statusColor}`}>
            {statusName(pool.status)}
          </span>
        </div>
      </div>

      {/* Contribution */}
      <div>
        <p className="text-2xl font-bold text-text">{formatUsdc(pool.contribution)} <span className="text-sm font-normal text-text-muted">mUSDC / round</span></p>
      </div>

      {/* Members + round */}
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          {Number(pool.memberCountJoined)}/{pool.memberCount} members
        </span>
        <span>Round {pool.currentRound}</span>
      </div>
    </div>
  );
}

export function PoolCard({ pool }: PoolCardProps) {
  // Sample pools: non-navigating (no link to detail route)
  if (pool.isSample) {
    return (
      <div className="cursor-default opacity-80">
        <CardContent pool={pool} />
      </div>
    );
  }

  return (
    <Link href={`/pools/${pool.address}`} className="block">
      <CardContent pool={pool} />
    </Link>
  );
}
