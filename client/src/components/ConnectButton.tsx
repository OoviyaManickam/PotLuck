'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { shortAddr } from '@/lib/format';
import { PillButton } from './PillButton';

export function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();
  const [switching, setSwitching] = useState(false);

  // Not yet ready (SSR / hydration) — render a disabled placeholder
  if (!ready) {
    return (
      <PillButton variant="accent" disabled>
        Connect
      </PillButton>
    );
  }

  // Fully signed out: normal login flow.
  if (!authenticated) {
    return (
      <PillButton variant="accent" onClick={() => login()}>
        Connect
      </PillButton>
    );
  }

  // Authenticated but wagmi has no address. This is the stuck state after a
  // MetaMask account switch: Privy still holds the old session, so calling
  // login() no-ops ("already logged in") and the modal never opens. The only
  // reliable fix is to end the session, then re-open login so the user can
  // pick the now-active account. logout() → login() chained via a flag.
  if (!address) {
    const reconnect = async () => {
      setSwitching(true);
      try {
        await logout();
        await login();
      } finally {
        setSwitching(false);
      }
    };
    return (
      <PillButton variant="accent" onClick={reconnect} disabled={switching}>
        {switching ? 'Reconnecting…' : 'Reconnect'}
      </PillButton>
    );
  }

  // Connected with an address: show it + a Disconnect that fully ends the
  // Privy session (so a subsequent Connect re-opens the wallet picker — the
  // supported way to switch to a different MetaMask account in one browser).
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
