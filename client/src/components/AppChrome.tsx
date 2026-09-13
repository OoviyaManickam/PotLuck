'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from './Navbar';
import { NetworkGuard } from './NetworkGuard';

/**
 * Renders Navbar + NetworkGuard for all routes except the landing page ("/").
 * This must be a client component because usePathname() is client-only.
 * The mounted guard ensures wagmi/Privy hooks are never called during SSR.
 */
export function AppChrome() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Landing page has its own transparent nav (Task 6) — skip here
  if (pathname === '/') return null;

  // Before mount: wagmi/privy providers aren't ready — render nothing
  if (!mounted) return null;

  return (
    <>
      <NetworkGuard />
      <Navbar />
    </>
  );
}
