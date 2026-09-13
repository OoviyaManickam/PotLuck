'use client';

import Link from 'next/link';
import { LogoIcon } from './LogoIcon';
import { ConnectButton } from './ConnectButton';

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

      {/* Right — nav links grouped next to wallet connect
          (balance + mint live on the page itself) */}
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-6 text-sm text-text-muted">
          <Link href="/pools" className="hover:text-text transition-colors">
            Pools
          </Link>
          <Link href="/profile" className="hover:text-text transition-colors">
            Profile
          </Link>
        </div>
        <ConnectButton />
      </div>
    </nav>
  );
}
