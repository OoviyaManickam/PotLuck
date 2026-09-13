'use client';

import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { ADDRESSES } from '@/lib/contracts';
import { registryAbi } from '@/lib/abis/registry';
import { tierName } from '@/lib/format';

export interface ReputationData {
  tier: number;
  tierLabel: string;
  cleanCycles: number;
  hasDefaulted: boolean;
  isLoading: boolean;
}

/**
 * Read reputation data for a given idKey from the ReputationRegistry.
 *
 * The connected user's idKey comes from their Member.idKey, obtained
 * via usePool(poolAddress).pool.members[mySlot].idKey.
 */
export function useReputation(idKey?: `0x${string}`): ReputationData {
  const client = usePublicClient();

  const { data, isLoading } = useQuery({
    queryKey: ['potluck', 'reputation', idKey] as const,
    enabled: !!client && !!idKey,
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !idKey) return null;

      const contracts = [
        {
          address: ADDRESSES.registry,
          abi: registryAbi,
          functionName: 'tierOf' as const,
          args: [idKey] as [`0x${string}`],
        },
        {
          address: ADDRESSES.registry,
          abi: registryAbi,
          functionName: 'cleanCycles' as const,
          args: [idKey] as [`0x${string}`],
        },
        {
          address: ADDRESSES.registry,
          abi: registryAbi,
          functionName: 'hasDefaulted' as const,
          args: [idKey] as [`0x${string}`],
        },
      ] as const;

      const results = await client.multicall({ contracts, allowFailure: true });

      const tierRes = results[0];
      const cleanRes = results[1];
      const defaultRes = results[2];

      return {
        tier: tierRes.status === 'success' ? (tierRes.result as number) : 0,
        cleanCycles: cleanRes.status === 'success' ? (cleanRes.result as number) : 0,
        hasDefaulted: defaultRes.status === 'success' ? (defaultRes.result as boolean) : false,
      };
    },
  });

  const tier = data?.tier ?? 0;

  return {
    tier,
    tierLabel: tierName(tier),
    cleanCycles: data?.cleanCycles ?? 0,
    hasDefaulted: data?.hasDefaulted ?? false,
    isLoading,
  };
}
