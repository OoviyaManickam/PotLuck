import { PillButton } from '../PillButton';

export function Hero() {
  return (
    <div className="relative h-screen overflow-hidden flex items-center justify-center px-6">
      {/* Background gradient with radial accent glow */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-surface to-bg"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(139, 127, 255, 0.15) 0%, transparent 50%), linear-gradient(to bottom, #1A1526, #0E0B14)',
        }}
      />

      {/* Video layer (overlaid, 404 graceful) */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
        style={{ opacity: 0.9 }}
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Rounded card container overlay */}
      <div className="absolute inset-6 md:inset-12 rounded-2xl bg-black/20 backdrop-blur-sm border border-surface-2/30" />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center gap-6 max-w-3xl">
        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-medium tracking-tight text-text leading-tight">
          Save together.
          <br />
          Get paid in turn.
        </h1>

        {/* Sub-line */}
        <p className="text-lg md:text-xl text-text-muted max-w-xl">
          Join a rotating savings group. Transparent, on-chain, for everyone.
        </p>

        {/* Tech marquee (optional, small) */}
        <div className="flex items-center gap-4 justify-center text-sm text-text-muted mt-4">
          <span>ENS</span>
          <span>·</span>
          <span>Privy</span>
          <span>·</span>
          <span>Sepolia</span>
        </div>

        {/* CTA button */}
        <div className="mt-6">
          <PillButton href="/pools" variant="accent" withArrow>
            Join a Pot
          </PillButton>
        </div>
      </div>
    </div>
  );
}
