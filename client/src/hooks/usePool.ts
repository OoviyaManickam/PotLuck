'use client';

import { usePublicClient } from 'wagmi';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { poolAbi } from '@/lib/abis/pool';
import type { PoolDetail, Member } from '@/lib/types';
import { PoolStatus } from '@/lib/types';

export function usePool(address?: `0x${string}`): {
  pool: PoolDetail | undefined;
  isLoading: boolean;
  refetch: () => void;
} {
  const client = usePublicClient();
  const { address: connectedWallet } = useAccount();

  const queryKey = ['potluck', 'pool', address, connectedWallet] as const;

  const { data: pool, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!client && !!address,
    staleTime: 10_000,
    // Poll for live state, but not so often that a free-tier RPC rate-limits
    // us. Retry transient failures (e.g. 429) with backoff so a blip doesn't
    // leave the page empty. Don't refetch on window focus/reconnect — the demo
    // flips focus between the app and MetaMask constantly, and each focus
    // refetch adds RPC load that can trip a 429.
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<PoolDetail> => {
      // `enabled` guards against this, but a queryFn must never return
      // undefined (react-query throws) — throw so it retries instead.
      if (!client || !address) throw new Error('Pool query not ready');

      // 1. Read primary detail fields via multicall.
      const detailContracts = [
        { address, abi: poolAbi, functionName: 'status' },
        { address, abi: poolAbi, functionName: 'currentRound' },
        { address, abi: poolAbi, functionName: 'memberCount' },
        { address, abi: poolAbi, functionName: 'memberCountJoined' },
        { address, abi: poolAbi, functionName: 'contribution' },
        { address, abi: poolAbi, functionName: 'pot' },
        { address, abi: poolAbi, functionName: 'roundEndsAt' },
        { address, abi: poolAbi, functionName: 'windowEndsAt' },
        { address, abi: poolAbi, functionName: 'getPayoutOrder' },
        { address, abi: poolAbi, functionName: 'poolId' },
        { address, abi: poolAbi, functionName: 'creator' },
        { address, abi: poolAbi, functionName: 'collateralReq' },
      ] as const;

      const detailResults = await client.multicall({ contracts: detailContracts, allowFailure: true });

      // All required fields must succeed. Throwing (rather than returning
      // undefined) lets react-query retry transient RPC failures — e.g. a
      // free-tier 429 — instead of surfacing a hard "data cannot be undefined"
      // error and leaving the page stuck.
      if (detailResults.some((r) => r.status === 'failure')) {
        throw new Error('Pool detail multicall failed (transient RPC error?)');
      }

      const status = (detailResults[0].result as number) as PoolStatus;
      const currentRound = detailResults[1].result as number;
      const memberCount = detailResults[2].result as number;
      const memberCountJoined = detailResults[3].result as bigint;
      const contribution = detailResults[4].result as bigint;
      const pot = detailResults[5].result as bigint;
      const roundEndsAt = detailResults[6].result as bigint;
      const windowEndsAt = detailResults[7].result as bigint;
      const payoutOrder = detailResults[8].result as readonly number[];
      const poolId = detailResults[9].result as bigint;
      const creator = detailResults[10].result as `0x${string}`;
      const collateralReq = detailResults[11].result as bigint;

      // 2. Read member data: getMember(slot) for slot 0..memberCount-1.
      let members: Member[] = [];

      if (memberCount > 0) {
        const memberContracts = Array.from({ length: memberCount }, (_, slot) => ({
          address,
          abi: poolAbi,
          functionName: 'getMember' as const,
          args: [BigInt(slot)] as [bigint],
        }));

        const memberResults = await client.multicall({ contracts: memberContracts, allowFailure: true });

        members = memberResults
          .map((r) => {
            if (r.status === 'failure') return null;
            const raw = r.result as {
              wallet: `0x${string}`;
              idKey: `0x${string}`;
              collateral: bigint;
              hasReceivedPot: boolean;
              active: boolean;
              defaultedThisCycle: boolean;
            };
            return {
              wallet: raw.wallet,
              idKey: raw.idKey,
              collateral: raw.collateral,
              hasReceivedPot: raw.hasReceivedPot,
              active: raw.active,
              defaultedThisCycle: raw.defaultedThisCycle,
            } satisfies Member;
          })
          .filter((m): m is Member => m !== null);
      }

      // 3. Read connected wallet's slot (slotOfPlusOne) — 0 = not a member.
      let mySlotPlusOne = 0n;
      let iPaidThisRound = false;

      if (connectedWallet) {
        const slotResult = await client.readContract({
          address,
          abi: poolAbi,
          functionName: 'slotOfPlusOne',
          args: [connectedWallet],
        }).catch(() => 0n);

        mySlotPlusOne = slotResult ?? 0n;

        // 4. If a member and status is ROUND_ACTIVE, check paid(currentRound, slot).
        if (mySlotPlusOne > 0n && status === PoolStatus.ROUND_ACTIVE) {
          const slot = mySlotPlusOne - 1n;
          const paidResult = await client.readContract({
            address,
            abi: poolAbi,
            functionName: 'paid',
            args: [currentRound, slot],
          }).catch(() => false);

          iPaidThisRound = paidResult ?? false;
        }
      }

      return {
        address,
        poolId,
        status,
        contribution,
        memberCount,
        memberCountJoined,
        currentRound,
        pot,
        roundEndsAt,
        windowEndsAt,
        payoutOrder,
        creator,
        collateralReq,
        members,
        mySlotPlusOne,
        iPaidThisRound,
      };
    },
  });

  return {
    pool,
    isLoading,
    refetch,
  };
}
