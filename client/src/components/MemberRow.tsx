'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { Member } from '@/lib/types';
import { useReputation } from '@/hooks/useReputation';
import { shortAddr } from '@/lib/format';
import { intendedMemberName, resolveReputationViaEns } from '@/lib/ens';

interface Props {
  member: Member;
  /** Zero-based slot index — used for ENS label construction and display. */
  slot: number;
  /** Pool ID — used for ENS subdomain display. */
  poolId: bigint;
}

export function MemberRow({ member, slot, poolId }: Props) {
  const rep = useReputation(member.idKey);
  const client = usePublicClient();

  // ENS live badge state — null default means "not resolved yet" (or unresolvable).
  // This is PURELY ADDITIVE: the row renders exactly as before when this is null.
  // potluck.eth is not registered yet so this will be null in production today.
  const [ensLive, setEnsLive] = useState<string | null>(null);

  // Intended ENS name: <addr-hex-no-0x>.pool<poolId>.potluck.eth
  // address-hex label matches fork-test convention.
  const memberLabel = member.wallet.slice(2).toLowerCase();
  const ensLabel = intendedMemberName(memberLabel, poolId);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    resolveReputationViaEns(client, ensLabel).then((text) => {
      if (!cancelled) setEnsLive(text);
    });

    return () => { cancelled = true; };
  }, [client, ensLabel]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-2 bg-surface hover:bg-surface-2/30 transition-colors">
      {/* Slot badge */}
      <span className="shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-surface-2 flex items-center justify-center text-xs font-semibold text-text-muted">
        {slot}
      </span>

      {/* Address + ENS */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{shortAddr(member.wallet)}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs text-text-muted truncate">{ensLabel}</p>
          {/* ENS live badge — additive enhancement; only shown when live resolution succeeds.
              When potluck.eth is unregistered (today), ensLive is null and this renders nothing.
              The row is IDENTICAL to its prior form when ensLive is null. */}
          {ensLive !== null && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-green-500/40 bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-300">
              live via ENS ✓
            </span>
          )}
        </div>
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
