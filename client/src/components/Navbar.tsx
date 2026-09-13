'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { LogoIcon } from './LogoIcon';
import { ConnectButton } from './ConnectButton';
import { MintUsdcButton } from './MintUsdcButton';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';

function BalanceDisplay() {
  const { address } = useAccount();
  const { formatted } = useUsdcBalance(address);

  if (!address) return null;

  return (
    <span className="text-sm text-text-muted">
      <span className="text-text font-medium">{formatted}</span>{' '}
      <span className="text-xs">mUSDC</span>
    </span>
  );
}

export function Navbar() {
  return (
    <nav className="w-full h-16 flex items-center justify-between px-6 border-b border-surface-2 bg-bg/80 backdrop-blur-md sticky top-0 z-40">
      {/* Left — logo + wordmark */}
      <Link
        href="/pools"
        className="flex items-center gap-2 text-text hover:text-accent transition-colors"
      >
        <LogoIcon size={28} className="text-accent" />
        <span className="font-bold text-lg tracking-tight">PotLuck</span>
      </Link>

      {/* Center — decorative nav links */}
      <div className="hidden md:flex items-center gap-6 text-sm text-text-muted">
        <Link href="/pools" className="hover:text-text transition-colors">
          Pools
        </Link>
        <Link href="/pools/create" className="hover:text-text transition-colors">
          Create Pool
        </Link>
      </div>

      {/* Right — balance + mint + connect */}
      <div className="flex items-center gap-3">
        <BalanceDisplay />
        <MintUsdcButton />
        <ConnectButton />
      </div>
    </nav>
  );
}
