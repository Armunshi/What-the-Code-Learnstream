import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Renders a 0-5 rating as five stars, supporting half-star fill (ratings are
// 1.0-5.0 in 0.5 steps — D7). Each star is drawn twice: a muted outline
// underneath, and a clipped foreground copy on top whose width is 0%, 50% or
// 100% depending on how much of that star the rating fills.
export function RatingStars({ rating = 0, max = 5, size = 16, className }) {
  const clamped = Math.min(max, Math.max(0, Number(rating) || 0));
  const stars = Array.from({ length: max }, (_, index) => {
    const fill = Math.min(1, Math.max(0, clamped - index)); // 0, 0.5 or 1
    return fill;
  });

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${clamped} out of ${max} stars`}
    >
      {stars.map((fill, index) => (
        <span key={index} className="relative inline-block" style={{ width: size, height: size }}>
          <Star className="absolute inset-0 text-muted-foreground/40" width={size} height={size} aria-hidden="true" />
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
            <Star
              className="fill-amber-400 text-amber-400"
              width={size}
              height={size}
              aria-hidden="true"
            />
          </span>
        </span>
      ))}
    </span>
  );
}

export default RatingStars;
