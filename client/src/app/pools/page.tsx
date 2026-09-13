'use client';

// Must be a Client Component to use ssr:false with next/dynamic.
// This prevents wagmi hook prerender errors (no WagmiProvider at build time).
import dynamic from 'next/dynamic';

const PoolsPageClient = dynamic(() => import('./PoolsPageClient'), { ssr: false });

export default function PoolsPage() {
  return <PoolsPageClient />;
}
