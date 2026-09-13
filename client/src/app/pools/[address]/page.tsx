'use client';

// Must be a Client Component to use ssr:false with next/dynamic.
// Mirrors the same pattern as /pools/page.tsx to prevent wagmi hook
// prerender errors (no WagmiProvider at build time).
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const PoolDetailClient = dynamic(() => import('./PoolDetailClient'), { ssr: false });

export default function PoolDetailPage() {
  const params = useParams();
  const address = typeof params?.address === 'string' ? params.address : '';

  return <PoolDetailClient address={address} />;
}
