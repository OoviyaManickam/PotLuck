'use client';

import { Member } from '@/lib/types';
import { useReputation } from '@/hooks/useReputation';
import { shortAddr } from '@/lib/format';

interface Props {
  member: Member;
  /** Zero-based slot index — used for ENS label construction and display. */
  slot: number;
  /** Pool ID — used for ENS subdomain display. */
  poolId: bigint;
}

export function MemberRow({ member, slot, poolId }: Props) {
  const rep = useReputation(member.idKey);

  // ENS display label: <slot>.pool<poolId>.potluck.eth
  // Live resolution is Task 9. For now we render the string directly.
  const ensLabel = `${slot}.pool${poolId}.potluck.eth`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-2 bg-surface hover:bg-surface-2/30 transition-colors">
      {/* Slot badge */}
      <span className="shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-surface-2 flex items-center justify-center text-xs font-semibold text-text-muted">
        {slot}
      </span>

      {/* Address + ENS */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{shortAddr(member.wallet)}</p>
        <p className="text-xs text-text-muted truncate">{ensLabel}</p>
      </div>

      {/* Reputation tier */}
      <div className="shrink-0 text-right">
        {rep.isLoading ? (
          <span className="text-xs text-text-muted">…</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-surface-2 border border-surface-2 px-2 py-0.5 text-xs text-text-muted">
            {rep.tierLabel}
          </span>
        )}
      </div>

      {/* Flags */}
      <div className="shrink-0 flex gap-1.5">
        {member.hasReceivedPot && (
          <Flag label="Received Pot" className="bg-accent/20 text-accent border-accent/40" />
        )}
        {!member.active && (
          <Flag label="Inactive" className="bg-red-500/20 text-red-400 border-red-500/40" />
        )}
        {member.defaultedThisCycle && (
          <Flag label="Defaulted" className="bg-orange-500/20 text-orange-400 border-orange-500/40" />
        )}
      </div>
    </div>
  );
}

function Flag({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
