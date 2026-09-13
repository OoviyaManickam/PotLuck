'use client';

import { useChainId, useSwitchChain } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { SEPOLIA_CHAIN_ID } from '@/lib/contracts';
import { PillButton } from './PillButton';

export function NetworkGuard() {
  const { ready, authenticated } = usePrivy();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  // Not connected or not ready — nothing to show
  if (!ready || !authenticated) return null;

  // On the correct chain — nothing to show
  if (chainId === SEPOLIA_CHAIN_ID) return null;

  return (
    <div className="w-full bg-red-900/30 border-b border-red-500/30 px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <span className="text-red-300">
        Wrong network detected. Please switch to Sepolia.
      </span>
      <PillButton
        variant="dark"
        disabled={isPending}
        onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
        className="!py-1 !px-3 !text-xs border border-red-500/40"
      >
        {isPending ? 'Switching…' : 'Switch to Sepolia'}
      </PillButton>
    </div>
  );
}
