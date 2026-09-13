'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { Member } from '@/lib/types';
import { useReputation } from '@/hooks/useReputation';
import { shortAddr } from '@/lib/format';
import { intendedMemberName, memberEnsLabel, parseReputationText, resolveReputationViaEns } from '@/lib/ens';

interface Props {
  member: Member;
  /** Zero-based slot index — used for ENS label construction and display. */
  slot: number;
  /** Pool ID — used for ENS subdomain display. */
  poolId: bigint;
  /** True when this row is the connected wallet — renders a "You" marker. */
  isMe?: boolean;
}

export function MemberRow({ member, slot, poolId, isMe = false }: Props) {
  const rep = useReputation(member.idKey);
  const client = usePublicClient();

  // ENS live badge state — null default means "not resolved yet" (or unresolvable).
  // This is PURELY ADDITIVE: the row renders exactly as before when this is null.
  // potluck.eth is live, so this resolves for members of pools minted under the
  // live naming adapter; it stays null for pre-go-live pools or an RPC hiccup.
  const [ensLive, setEnsLive] = useState<string | null>(null);

  // Popover: lets a prospective joiner click the "live via ENS ✓" badge to
  // inspect this member's live ENS reputation before deciding to trust the pool.
  // Click-to-toggle (not hover) so it works on touch and stays open to read.
  const [repOpen, setRepOpen] = useState(false);

  // Parsed live reputation (from the ENS text record) — only meaningful once
  // ensLive resolves. null until then, matching the badge's own gate.
  const parsedRep = ensLive !== null ? parseReputationText(ensLive) : null;

  // Intended ENS name: <addr-hex-incl-0x>.pool<poolId>.potluck.eth
  // memberEnsLabel keeps the 0x prefix so the label matches PotluckENS._memberLabel
  // (_toHexString) on-chain — dropping 0x would miss the recorded idKeyOf.
  const memberLabel = memberEnsLabel(member.wallet);
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
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isMe
          ? 'border-accent/50 bg-accent/5 hover:bg-accent/10'
          : 'border-surface-2 bg-surface hover:bg-surface-2/30'
      }`}
    >
      {/* Slot badge */}
      <span className="shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-surface-2 flex items-center justify-center text-xs font-semibold text-text-muted">
        {slot}
      </span>

      {/* Address + ENS */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-text truncate">{shortAddr(member.wallet)}</p>
          {isMe && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs text-text-muted truncate">{ensLabel}</p>
          {/* ENS live badge — additive enhancement; only shown when live resolution succeeds.
              potluck.eth is live, so this lights up for members of pools minted under the live
              naming adapter. When ensLive is null (pre-go-live pool / RPC hiccup) the row is
              IDENTICAL to its prior form. The badge is clickable: it toggles a popover showing
              this member's live ENS reputation so a prospective joiner can vet each member. */}
          {ensLive !== null && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setRepOpen((o) => !o)}
                aria-expanded={repOpen}
                aria-label="View this member's ENS reputation"
                className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-300 transition-colors hover:bg-green-500/25 focus:outline-none focus-visible:ring-1 focus-visible:ring-green-400/60 cursor-pointer"
              >
                live via ENS ✓
              </button>

              {repOpen && (
                <>
                  {/* Click-away layer: closes the popover on any outside click. */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setRepOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="dialog"
                    aria-label="Member ENS reputation"
                    className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-green-500/30 bg-surface p-3 shadow-lg shadow-black/40 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      <p className="text-[11px] font-semibold text-green-300">
                        Reputation via ENS
                      </p>
                    </div>
                    {parsedRep && (
                      <div className="space-y-0.5 text-[11px] text-text-muted">
                        {parsedRep.tier !== undefined && (
                          <p>Tier: <span className="font-medium text-text">{parsedRep.tier}</span></p>
                        )}
                        {parsedRep.cleanCycles !== undefined && (
                          <p>Clean cycles: <span className="font-medium text-text">{parsedRep.cleanCycles}</span></p>
                        )}
                        {parsedRep.defaulted !== undefined && (
                          <p>
                            Defaulted:{' '}
                            <span className={`font-medium ${parsedRep.defaulted ? 'text-orange-400' : 'text-green-400'}`}>
                              {parsedRep.defaulted ? 'Yes' : 'No'}
                            </span>
                          </p>
                        )}
                        {parsedRep.raw && (
                          <p className="font-mono break-all text-text-muted">{parsedRep.raw}</p>
                        )}
                      </div>
                    )}
                    <p className="pt-1 font-mono text-[10px] text-text-muted break-all border-t border-surface-2">
                      {ensLabel}
                    </p>
                  </div>
                </>
              )}
            </div>
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
