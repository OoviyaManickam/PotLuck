'use client';

import { PoolDetail, PoolStatus } from '@/lib/types';
import { formatUsdc, statusName } from '@/lib/format';
import { shortAddr } from '@/lib/format';

// Status badge color mapping
const STATUS_BADGE: Record<PoolStatus, string> = {
  [PoolStatus.OPEN]: 'bg-green-500/20 text-green-400 border-green-500/40',
  [PoolStatus.LOCKED]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  [PoolStatus.ROUND_ACTIVE]: 'bg-accent/20 text-accent border-accent/40',
  [PoolStatus.COMPLETE]: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  [PoolStatus.CANCELLED]: 'bg-red-500/20 text-red-400 border-red-500/40',
};

interface Props {
  pool: PoolDetail;
}

export function PoolState({ pool }: Props) {
  const {
    status,
    currentRound,
    memberCount,
    memberCountJoined,
    contribution,
    pot,
    payoutOrder,
    members,
  } = pool;

  const badgeCls = STATUS_BADGE[status] ?? 'bg-surface-2 text-text-muted border-surface-2';

  return (
    <section className="rounded-2xl border border-surface-2 bg-surface p-6 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-text">Pool Overview</h2>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${badgeCls}`}
        >
          {statusName(status)}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatTile label="Round" value={String(currentRound)} />
        <StatTile label="Members" value={`${memberCountJoined}/${memberCount}`} />
        <StatTile label="Contribution" value={`${formatUsdc(contribution)} mUSDC`} />
        <StatTile label="Pot" value={`${formatUsdc(pot)} mUSDC`} />
      </div>

      {/* Payout order */}
      {payoutOrder.length > 0 && (
        <div>
          <p className="text-xs text-text-muted mb-1.5">Payout Order</p>
          <div className="flex flex-wrap gap-1.5">
            {payoutOrder.map((slot, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-surface-2 border border-surface-2 px-2.5 py-0.5 text-xs text-text-muted"
              >
                #{idx + 1}: Slot {slot}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* COMPLETE final summary — no restart */}
      {status === PoolStatus.COMPLETE && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-purple-300">Cycle Complete</p>
          <p className="text-xs text-text-muted">
            All rounds have finished. Members who received the pot:
          </p>
          <ul className="flex flex-col gap-1">
            {members
              .filter((m) => m.hasReceivedPot)
              .map((m) => (
                <li key={m.wallet} className="text-xs text-text">
                  {shortAddr(m.wallet)}
                </li>
              ))}
            {members.filter((m) => m.hasReceivedPot).length === 0 && (
              <li className="text-xs text-text-muted">No payouts recorded.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-2 bg-surface-2/30 px-4 py-3 flex flex-col gap-0.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text truncate">{value}</p>
    </div>
  );
}
