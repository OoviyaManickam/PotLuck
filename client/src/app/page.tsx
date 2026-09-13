import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <LandingNav />
      <Hero />
    </div>
  );
}
