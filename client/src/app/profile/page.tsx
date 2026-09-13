'use client';

// Must be a Client Component to use ssr:false with next/dynamic.
// Mirrors the same pattern as /pools/page.tsx to prevent wagmi hook
// prerender errors (no WagmiProvider at build time).
import dynamic from 'next/dynamic';

const ProfilePageClient = dynamic(() => import('./ProfilePageClient'), { ssr: false });

export default function ProfilePage() {
  return <ProfilePageClient />;
}
