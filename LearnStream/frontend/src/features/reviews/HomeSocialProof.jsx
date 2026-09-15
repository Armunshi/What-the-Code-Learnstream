import { TestimonialCarousel } from './components/TestimonialCarousel.jsx';
import { StatsStrip } from './components/StatsStrip.jsx';
import { TrustBar } from './components/TrustBar.jsx';

// Wraps TestimonialCarousel, StatsStrip, TrustBar for the homepage.
export function HomeSocialProof() {
  return (
    <section className="flex flex-col gap-10 py-10" data-testid="home-social-proof">
      <StatsStrip />
      <TestimonialCarousel />
      <TrustBar />
    </section>
  );
}

export default HomeSocialProof;
