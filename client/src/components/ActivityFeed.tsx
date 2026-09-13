'use client';

import { useEffect, useState } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { poolAbi } from '@/lib/abis/pool';
import { FACTORY_DEPLOY_BLOCK, getContractEventsChunked } from '@/lib/contracts';
import { shortAddr } from '@/lib/format';
import type { Log } from 'viem';

interface ActivityItem {
  id: string;
  blockNumber: bigint;
  txHash: `0x${string}` | null;
  description: string;
}

function describeLog(log: Log & { eventName?: string; args?: Record<string, unknown> }): string {
  const args = log.args ?? {};
  switch (log.eventName) {
    case 'MemberJoined': {
      const wallet = args.wallet as `0x${string}` | undefined;
      const slot = args.slot as bigint | undefined;
      return `Member ${wallet ? shortAddr(wallet) : '?'} joined (slot ${slot ?? '?'})`;
    }
    case 'ContributionPaid': {
      const round = args.round as number | undefined;
      const slot = args.slot as bigint | undefined;
      return `Slot ${slot ?? '?'} paid contribution in round ${round ?? '?'}`;
    }
    case 'PotPaid': {
      const round = args.round as number | undefined;
      const winnerSlot = args.winnerSlot as bigint | undefined;
      return `Pot paid to slot ${winnerSlot ?? '?'} in round ${round ?? '?'}`;
    }
    case 'RoundAdvanced': {
      const newRound = args.newRound as number | undefined;
      return `Round advanced to ${newRound ?? '?'}`;
    }
    case 'CycleCompleted':
      return 'Cycle completed';
    default:
      return log.eventName ?? 'Unknown event';
  }
}

const WATCHED_EVENTS = [
  'MemberJoined',
  'ContributionPaid',
  'PotPaid',
  'RoundAdvanced',
  'CycleCompleted',
] as const;

interface Props {
  poolAddr: `0x${string}`;
}

export function ActivityFeed({ poolAddr }: Props) {
  const publicClient = usePublicClient();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Historical fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    async function fetchHistory() {
      if (!publicClient) return;
      setLoading(true);

      try {
        // Paged into small windows so free-tier RPCs (which cap eth_getLogs
        // at a narrow block range) accept every request.
        const fetches = WATCHED_EVENTS.map((eventName) =>
          getContractEventsChunked(
            publicClient,
            {
              address: poolAddr,
              abi: poolAbi,
              eventName,
            },
            FACTORY_DEPLOY_BLOCK,
          ) as Promise<Array<Log>>,
        );

        const results = await Promise.allSettled(fetches);
        if (cancelled) return;

        const allLogs: ActivityItem[] = [];

        results.forEach((result, idx) => {
          if (result.status !== 'fulfilled') return;
          const eventName = WATCHED_EVENTS[idx];
          result.value.forEach((log) => {
            const typedLog = log as Log & { eventName?: string; args?: Record<string, unknown> };
            typedLog.eventName = eventName;
            allLogs.push({
              id: `${log.transactionHash ?? 'unknown'}-${log.logIndex ?? Math.random()}`,
              blockNumber: log.blockNumber ?? 0n,
              txHash: (log.transactionHash as `0x${string}` | null) ?? null,
              description: describeLog(typedLog),
            });
          });
        });

        // Sort reverse-chronological by block number
        allLogs.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0));

        setItems(allLogs);
      } catch (_) {
        // Non-fatal — feed just shows empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [publicClient, poolAddr]);

  // ── Live event watchers ────────────────────────────────────────────────────
  // useWatchContractEvent for each event type; prepend new items to the list.

  function appendLive(eventName: string, log: Log) {
    const typedLog = log as Log & { eventName?: string; args?: Record<string, unknown> };
    typedLog.eventName = eventName;
    const newItem: ActivityItem = {
      id: `live-${log.transactionHash ?? Date.now()}-${log.logIndex ?? Math.random()}`,
      blockNumber: log.blockNumber ?? 0n,
      txHash: (log.transactionHash as `0x${string}` | null) ?? null,
      description: describeLog(typedLog),
    };
    setItems((prev) => {
      // Deduplicate by id
      if (prev.some((p) => p.id === newItem.id)) return prev;
      return [newItem, ...prev];
    });
  }

  useWatchContractEvent({
    address: poolAddr,
    abi: poolAbi,
    eventName: 'MemberJoined',
    onLogs: (logs) => logs.forEach((l) => appendLive('MemberJoined', l as Log)),
  });

  useWatchContractEvent({
    address: poolAddr,
    abi: poolAbi,
    eventName: 'ContributionPaid',
    onLogs: (logs) => logs.forEach((l) => appendLive('ContributionPaid', l as Log)),
  });

  useWatchContractEvent({
    address: poolAddr,
    abi: poolAbi,
    eventName: 'PotPaid',
    onLogs: (logs) => logs.forEach((l) => appendLive('PotPaid', l as Log)),
  });

  useWatchContractEvent({
    address: poolAddr,
    abi: poolAbi,
    eventName: 'RoundAdvanced',
    onLogs: (logs) => logs.forEach((l) => appendLive('RoundAdvanced', l as Log)),
  });

  useWatchContractEvent({
    address: poolAddr,
    abi: poolAbi,
    eventName: 'CycleCompleted',
    onLogs: (logs) => logs.forEach((l) => appendLive('CycleCompleted', l as Log)),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-2xl border border-surface-2 bg-surface p-6 flex flex-col gap-4">
      <h2 className="text-base font-semibold text-text">Activity</h2>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-surface-2 bg-surface-2/20 px-4 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text">{item.description}</p>
                <p className="text-xs text-text-muted">Block {String(item.blockNumber)}</p>
              </div>
              {item.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-accent hover:underline"
                >
                  Tx
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
