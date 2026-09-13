import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';

export default function Home() {
  return (
    <div className="h-screen overflow-hidden">
      <LandingNav />
      <Hero />
    </div>
  );
}
