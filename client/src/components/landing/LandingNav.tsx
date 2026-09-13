import Link from 'next/link';
import { LogoIcon } from '../LogoIcon';
import { PillButton } from '../PillButton';

export function LandingNav() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
      {/* Logo + wordmark */}
      <Link href="/" className="flex items-center gap-3">
        <LogoIcon className="text-text" size={32} />
        <span className="text-lg font-semibold tracking-tight text-text">PotLuck</span>
      </Link>

      {/* Center decorative links (hidden below md) */}
      <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        <a href="#" className="text-sm text-text-muted hover:text-text transition-colors">
          About
        </a>
        <a href="#" className="text-sm text-text-muted hover:text-text transition-colors">
          Features
        </a>
        <a href="#" className="text-sm text-text-muted hover:text-text transition-colors">
          Docs
        </a>
      </div>

      {/* Launch App button */}
      <PillButton href="/pools" variant="accent">
        Launch App
      </PillButton>
    </nav>
  );
}
