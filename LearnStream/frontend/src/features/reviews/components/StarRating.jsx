import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/lib/utils';

// Read-only 5-star display supporting half-steps (D7: ratings are 1.0-5.0 in
// 0.5 steps), shared by ReviewCard, RatingDistribution's header and
// TestimonialCarousel so the same rounding rule renders everywhere.
export function StarRating({ rating, size = 16, className }) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(safeRating);
  const hasHalf = safeRating - full >= 0.5;

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-amber-500', className)} data-testid="star-rating">
      {Array.from({ length: 5 }, (_, i) => {
        const index = i + 1;
        if (index <= full) {
          return <Star key={index} width={size} height={size} fill="currentColor" strokeWidth={0} />;
        }
        if (index === full + 1 && hasHalf) {
          return <StarHalf key={index} width={size} height={size} fill="currentColor" strokeWidth={0} />;
        }
        return <Star key={index} width={size} height={size} className="text-muted-foreground/30" />;
      })}
    </span>
  );
}

export default StarRating;
