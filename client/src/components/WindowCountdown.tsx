'use client';

import { useEffect, useState } from 'react';
import { PoolStatus } from '@/lib/types';

interface Props {
  /** windowEndsAt() from the pool — unix seconds (bigint). */
  windowEndsAt: bigint;
  status: PoolStatus;
}

/** Format a non-negative number of seconds as M:SS. */
function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

/**
 * Live status pill for the contribution window during ROUND_ACTIVE.
 *
 * The contract closes contributions and gates settleRound() on the same
 * `windowEndsAt` timestamp (ROSCAPool.sol: contribute() reverts WindowClosed
 * once now > windowEndsAt; settleRound() reverts NotYetTimeToAdvance until
 * now > windowEndsAt). So a single countdown communicates both: while it's
 * ticking, members contribute and Settle is not yet callable; once it hits
 * zero, contributions are closed and the round is ready to settle.
 *
 * Ticks once a second purely client-side — no extra RPC load.
 */
export function WindowCountdown({ windowEndsAt, status }: Props) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    // Only run the ticker while it's meaningful (ROUND_ACTIVE with a window).
    if (status !== PoolStatus.ROUND_ACTIVE) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Only meaningful during ROUND_ACTIVE with a real window timestamp.
  if (status !== PoolStatus.ROUND_ACTIVE || windowEndsAt === 0n) return null;

  const endSec = Number(windowEndsAt);
  const remaining = endSec - nowSec;
  const open = remaining > 0;

  if (open) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden />
        <span>
          Contribution window open —{' '}
          <span className="font-mono font-semibold tabular-nums">{fmt(remaining)}</span> left
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
      <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
      <span>Window closed — ready to settle</span>
    </div>
  );
}
