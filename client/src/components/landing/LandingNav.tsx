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

      {/* Launch App button */}
      <PillButton href="/pools" variant="accent">
        Launch App
      </PillButton>
    </nav>
  );
}
