'use client';

import { useReadContract } from 'wagmi';
import { ADDRESSES } from '@/lib/contracts';
import { mockUsdcAbi } from '@/lib/abis/mockUsdc';
import { formatUsdc } from '@/lib/format';

interface UseUsdcBalanceReturn {
  balance: bigint;
  formatted: string;
  refetch: () => void;
}

export function useUsdcBalance(address?: `0x${string}`): UseUsdcBalanceReturn {
  const { data, refetch } = useReadContract({
    address: ADDRESSES.mockUsdc,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  const balance = (data as bigint | undefined) ?? 0n;

  return {
    balance,
    formatted: formatUsdc(balance),
    refetch: () => { void refetch(); },
  };
}
