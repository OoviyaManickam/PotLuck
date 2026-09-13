'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { shortAddr } from '@/lib/format';
import { PillButton } from './PillButton';

export function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();

  // Not yet ready (SSR / hydration) — render a disabled placeholder
  if (!ready) {
    return (
      <PillButton variant="accent" disabled>
        Connect
      </PillButton>
    );
  }

  if (!authenticated || !address) {
    return (
      <PillButton variant="accent" onClick={() => login()}>
        Connect
      </PillButton>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-muted font-mono">
        {shortAddr(address)}
      </span>
      <PillButton variant="ghost" onClick={() => logout()}>
        Disconnect
      </PillButton>
    </div>
  );
}
