'use client';

import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ADDRESSES, FACTORY_DEPLOY_BLOCK, getContractEventsChunked } from '@/lib/contracts';
import { factoryAbi } from '@/lib/abis/factory';
import { poolAbi } from '@/lib/abis/pool';
import type { PoolSummary } from '@/lib/types';
import { PoolStatus } from '@/lib/types';

const POOLS_QUERY_KEY = ['potluck', 'pools'] as const;

// @check: getContractEvents call below typechecks against factoryAbi —
// eventName: 'PoolCreated' is present in factoryAbi, and the returned
// log.args.pool / log.args.poolId fields match the indexed/non-indexed
// inputs in that event definition.

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
    staleTime: 30_000,
    queryFn: async (): Promise<PoolSummary[]> => {
      if (!client) return [];

      // 1. Enumerate all pool addresses via PoolCreated events.
      //    Paged into small windows so free-tier RPCs (which cap eth_getLogs
      //    at a narrow block range) accept every request — a single wide
      //    fromBlock→latest scan is rejected outright and would leave the
      //    list showing only sample pools.
      const logs = (await getContractEventsChunked(
        client,
        {
          address: ADDRESSES.factory,
          abi: factoryAbi,
          eventName: 'PoolCreated',
        },
        FACTORY_DEPLOY_BLOCK,
      )) as Array<{ args: { pool?: `0x${string}` } }>;

      if (logs.length === 0) return [];

      const poolAddresses = logs.map((log) => log.args.pool as `0x${string}`);

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

      return summaries;
    },
  });

  // Live updates: invalidate on every new PoolCreated event.
  useWatchContractEvent({
    address: ADDRESSES.factory,
    abi: factoryAbi,
    eventName: 'PoolCreated',
    onLogs: () => {
      queryClient.invalidateQueries({ queryKey: POOLS_QUERY_KEY });
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
