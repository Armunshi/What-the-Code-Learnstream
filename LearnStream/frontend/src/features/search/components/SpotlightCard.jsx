import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RatingStars } from '@/components/common/RatingStars';
import { formatCount, formatHoursMinutes } from '@/lib/format';

/** "AI Overview" — title, badge, rating, lecture count, level, View course
 * CTA (plan §6.4). `spotlight` is `null` below the score threshold
 * (services/search/spotlight.js), in which case this renders nothing. */
export function SpotlightCard({ spotlight }) {
  if (!spotlight) return null;
  const { intent, course } = spotlight;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center" data-testid="spotlight-card">
      <div className="flex items-center gap-2 sm:hidden">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">{spotlight.title}</span>
      </div>

      <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold text-muted-foreground">{spotlight.title}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm text-muted-foreground">{intent}</p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <h3 className="text-base font-semibold text-foreground">{course.title}</h3>
          {course.level ? (
            <Badge variant="outline" className="w-fit capitalize">
              {course.level}
            </Badge>
          ) : null}
          {course.rating?.count > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-amber-700">{course.rating.avg.toFixed(1)}</span>
              <RatingStars rating={course.rating.avg} size={12} />
              <span className="text-xs text-muted-foreground">({formatCount(course.rating.count)})</span>
            </div>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatCount(course.lectureCount)} lectures · {formatHoursMinutes(course.totalDurationSec)}
          </span>
        </div>
      </div>

      <Link
        to={`/course/${course.id}`}
        data-testid="spotlight-view-course"
        className="shrink-0 rounded-md border bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        View course
      </Link>
    </div>
  );
}

export default SpotlightCard;
