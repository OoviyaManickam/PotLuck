'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

/** CloudFront-hosted hero background video (coins / lavender). */
const HERO_VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4';

export function Hero() {
  return (
    // Outer: dark frame around a centered video card.
    <div className="flex-1 px-6 pt-20 pb-6 flex items-end">
      {/* Inner card — the video fills this; the dark page shows as a frame. */}
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ height: 'calc(100vh - 96px)' }}
      >
        {/* Background video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>

        {/* Content overlay — left-aligned, pinned upper-left. */}
        <div className="relative z-10 flex flex-col items-start justify-start h-full p-12 pt-36">
          {/* Headline */}
          <h1
            className="text-black text-5xl md:text-6xl font-medium leading-tight max-w-xl mb-4"
            style={{ letterSpacing: '-0.04em' }}
          >
            The oldest way to save.
            <br />
            Now trustless.
          </h1>

          {/* Sub-line */}
          <p
            className="text-black/70 text-base md:text-lg max-w-md mb-8 leading-relaxed"
            style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
          >
            Savings circles ran on a handshake for centuries and broke on the
            first person who walked away. PotLuck swaps blind faith for
            collateral and code: everyone pays in, everyone gets their turn,
            enforced on-chain.
          </p>

          {/* CTA pill — black bg, white arrow circle */}
          <Link
            href="/pools"
            className="inline-flex items-center gap-3 bg-black text-white text-base md:text-lg font-medium pl-8 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            Join a Pot
            <span className="flex items-center justify-center bg-white rounded-full p-2">
              <ArrowRight className="w-5 h-5 text-black" />
            </span>
          </Link>

          {/* Tech row — bottom-left */}
          <div className="mt-auto flex items-center gap-6 text-xs font-medium tracking-wide text-black/60 uppercase">
            <span>ENS</span>
            <span>Privy</span>
            <span>Sepolia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
