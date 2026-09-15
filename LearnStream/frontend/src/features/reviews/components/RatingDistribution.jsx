import { Progress } from '@/components/ui/progress';
import { formatCount } from '@/lib/format';
import { StarRating } from './StarRating.jsx';

// `distribution` is already the largest-remainder percentages from
// GET /courses/:courseId/rating-summary (ratingStats.js
// toRatingDistributionPercentages) — always sums to exactly 100, so this
// component only ever renders what the backend computed, no re-derivation.
export function RatingDistribution({ averageRating, totalRatingsCount, distribution }) {
  const rows = [5, 4, 3, 2, 1];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="rating-distribution">
      <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
        <span className="text-4xl font-bold leading-none">{(Number(averageRating) || 0).toFixed(1)}</span>
        <StarRating rating={averageRating} size={18} />
        <span className="text-xs text-muted-foreground">{formatCount(totalRatingsCount)} ratings</span>
      </div>

      <div className="flex-1 space-y-1.5">
        {rows.map((star) => {
          const pct = distribution?.[star] ?? 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3 shrink-0 text-muted-foreground">{star}</span>
              <Progress value={pct} className="h-2 flex-1" aria-label={`${star} star: ${pct}%`} />
              <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RatingDistribution;
