'use client';

import { usePublicClient } from 'wagmi';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  ADDRESSES,
  FACTORY_DEPLOY_BLOCK,
  getContractEventsChunkedWithCursor,
} from '@/lib/contracts';
import { factoryAbi } from '@/lib/abis/factory';
import { poolAbi } from '@/lib/abis/pool';
import type { PoolSummary } from '@/lib/types';
import { PoolStatus } from '@/lib/types';

const POOLS_QUERY_KEY = ['potluck', 'pools'] as const;

// ── Pool-address discovery cache ─────────────────────────────────────────────
// Enumerating pools means scanning PoolCreated logs from the factory deploy
// block to head, chunked into ≤10-block windows for free-tier RPCs. That's
// ~140+ eth_getLogs requests and grows every block — re-running it on every
// refetch quickly trips the RPC's rate limit (HTTP 429), which the browser
// then also surfaces as a CORS error. Pools never disappear, so we persist the
// addresses we've found plus the block we scanned up to, and each subsequent
// run only scans the handful of new blocks since. localStorage so it survives
// reloads (the demo flips between accounts a lot).
const CACHE_KEY = 'potluck.pools.discovery.v1';

interface DiscoveryCache {
  /** Deduped pool addresses discovered so far (lowercased). */
  addresses: string[];
  /** Highest block fully scanned. Next scan starts at lastBlock + 1. */
  lastBlock: string; // bigint serialized as decimal string
}

function readCache(): DiscoveryCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiscoveryCache;
    if (!Array.isArray(parsed.addresses) || typeof parsed.lastBlock !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: DiscoveryCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota/private-mode — non-fatal, we just re-scan next time.
  }
}

export function usePools(): {
  pools: PoolSummary[];
  isLoading: boolean;
  refetch: () => void;
} {
  const client = usePublicClient();
  const queryClient = useQueryClient();

  const { data: pools = [], isLoading, refetch } = useQuery({
    queryKey: POOLS_QUERY_KEY,
    enabled: !!client,
    // Pools change slowly; keep the data fresh for a while and don't refetch
    // on every window focus/reconnect. This is the main lever that stops the
    // demo (which flips browser focus between app + MetaMask constantly) from
    // hammering the RPC.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // Keep the last good result on screen while a refetch runs — notably across
    // an account switch, which remounts consumers. Without this the grid drops
    // to a skeleton (showing only the hardcoded samples) until the scan+
    // multicall complete; with it, known pools stay painted and the fresh data
    // swaps in when ready.
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<PoolSummary[]> => {
      if (!client) return [];

      // 1. Enumerate pool addresses via PoolCreated events — but only scan
      //    blocks we haven't scanned before. Start from the cached cursor
      //    (falling back to the factory deploy block on a cold cache).
      const cache = readCache();
      const cachedAddresses = new Set<string>(cache?.addresses ?? []);
      const scanFrom = cache ? BigInt(cache.lastBlock) + 1n : FACTORY_DEPLOY_BLOCK;

      const { logs, scannedTo, complete } = await getContractEventsChunkedWithCursor(
        client,
        {
          address: ADDRESSES.factory,
          abi: factoryAbi,
          eventName: 'PoolCreated',
        },
        scanFrom,
      );

      for (const log of logs as Array<{ args: { pool?: `0x${string}` } }>) {
        const pool = log.args.pool;
        if (pool) cachedAddresses.add(pool.toLowerCase());
      }

      // Persist the addresses we've discovered on EVERY run — even a partial
      // (429'd) scan — so a pool seen once is never lost on the next mount and
      // reappears instantly on an account switch or reload. The cursor
      // (lastBlock) is the delicate part: only advance it when the whole range
      // scanned cleanly, otherwise a partial scan would let us skip past blocks
      // we never actually read and permanently miss a pool. On an incomplete
      // scan we keep the previous cursor (or FACTORY_DEPLOY_BLOCK - 1 on a cold
      // cache) so the next run re-scans the same range.
      if (complete) {
        writeCache({ addresses: [...cachedAddresses], lastBlock: scannedTo.toString() });
      } else {
        const prevCursor = cache?.lastBlock ?? (FACTORY_DEPLOY_BLOCK - 1n).toString();
        writeCache({ addresses: [...cachedAddresses], lastBlock: prevCursor });
      }

      const poolAddresses = [...cachedAddresses] as `0x${string}`[];
      if (poolAddresses.length === 0) return [];

      // 2. Batch-read summary fields for every pool using multicall.
      type SummaryField = 'status' | 'contribution' | 'memberCount' | 'memberCountJoined' | 'currentRound' | 'poolId';
      const fields: SummaryField[] = ['status', 'contribution', 'memberCount', 'memberCountJoined', 'currentRound', 'poolId'];

      const contracts = poolAddresses.flatMap((address) =>
        fields.map((functionName) => ({
          address,
          abi: poolAbi,
          functionName,
        }))
      );

      const results = await client.multicall({ contracts, allowFailure: true });

      const summaries: PoolSummary[] = [];

      for (let i = 0; i < poolAddresses.length; i++) {
        const base = i * fields.length;
        const get = (offset: number) => results[base + offset];

        const statusRes = get(0);
        const contributionRes = get(1);
        const memberCountRes = get(2);
        const memberCountJoinedRes = get(3);
        const currentRoundRes = get(4);
        const poolIdRes = get(5);

        // Skip pools where reads failed
        if (
          statusRes.status === 'failure' ||
          contributionRes.status === 'failure' ||
          memberCountRes.status === 'failure' ||
          memberCountJoinedRes.status === 'failure' ||
          currentRoundRes.status === 'failure' ||
          poolIdRes.status === 'failure'
        ) {
          continue;
        }

        summaries.push({
          address: poolAddresses[i],
          poolId: poolIdRes.result as bigint,
          status: (statusRes.result as number) as PoolStatus,
          contribution: contributionRes.result as bigint,
          memberCount: memberCountRes.result as number,
          memberCountJoined: memberCountJoinedRes.result as bigint,
          currentRound: currentRoundRes.result as number,
        });
      }

      // Sort by poolId ascending so ordering is stable across runs (the cache
      // is a Set, so insertion order isn't meaningful).
      summaries.sort((a, b) => (a.poolId < b.poolId ? -1 : a.poolId > b.poolId ? 1 : 0));

      return summaries;
    },
  });

  return {
    pools,
    isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: POOLS_QUERY_KEY });
    },
  };
}
