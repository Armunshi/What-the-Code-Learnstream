import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RatingStars } from '@/components/common/RatingStars';
import { PurchaseCta } from '@/features/commerce';
import { WishlistButton } from '@/features/wishlist';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all: 'All levels',
};

const BADGE_LABELS = {
  bestseller: 'Bestseller',
  highest_rated: 'Highest Rated',
  new: 'New',
};

function formatUpdatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date);
}

// docs/contracts/stubs.md's exact popover copy example is decimal hours
// ("12.5 total hours"), a different rendering purpose than lib/format.js's
// formatHoursMinutes ("12h 32m", the course-header form) — kept as a small
// local helper rather than a change to that frozen shared file.
function formatTotalHours(totalSeconds) {
  const hours = Math.max(0, Number(totalSeconds) || 0) / 3600;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} total hours`;
}

/**
 * CoursePopover — content only; the controlled Popover shell (open state,
 * placement, hover-intent timing) lives in CourseCard, which is the only
 * current caller. Kept as a separate component (per docs/contracts/stubs.md,
 * "built alongside CourseCard") so the search results grid can reuse this
 * exact content unchanged (FR-SRC-2.3) if it ever needs its own trigger.
 */
export function CoursePopoverContent({ course, titleId }) {
  const ratingCount = course.rating?.count ?? 0;
  const ratingAvg = course.rating?.avg ?? 0;
  const updated = formatUpdatedAt(course.updatedAt);

  return (
    <div data-testid="course-popover" role="dialog" aria-labelledby={titleId} className="flex flex-col gap-2">
      {course.badge ? (
        <span className="w-fit rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
          {BADGE_LABELS[course.badge] ?? course.badge}
        </span>
      ) : null}

      <p id={titleId} className="text-sm font-semibold text-foreground line-clamp-2">
        {course.title}
      </p>

      {ratingCount > 0 ? (
        <span
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-label={`${ratingAvg.toFixed(1)} out of 5 stars, ${formatCount(ratingCount)} ratings`}
        >
          <RatingStars rating={ratingAvg} size={12} />
          {ratingAvg.toFixed(1)} ★ ({formatCount(ratingCount)} ratings)
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">No ratings yet</span>
      )}

      <p className="text-xs text-muted-foreground">
        {[updated ? `Updated ${updated}` : null, formatTotalHours(course.totalDurationSec), `${course.lectureCount ?? 0} lectures`, LEVEL_LABELS[course.level] ?? course.level]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {course.objectives?.length > 0 ? (
        <div className="mt-1">
          <p className="text-xs font-semibold text-foreground">What you&apos;ll learn</p>
          <ul className="mt-1 space-y-1">
            {course.objectives.map((objective, index) => (
              <li key={index} className="text-xs text-muted-foreground">
                • {objective}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <PurchaseCta course={course} variant="popover" />
        <WishlistButton courseId={course.id} />
      </div>
    </div>
  );
}

/**
 * The controlled shadcn Popover shell itself — CourseCard passes `open` and
 * `onOpenChange` (its own useHoverIntent + CoursePopoverGroup coordination);
 * this component only owns placement and the trigger/content wiring.
 */
export function CoursePopover({ course, open, onOpenChange, triggerRef, pointerHandlers, titleId, className }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={cn('sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:z-10 focus-visible:rounded focus-visible:bg-background focus-visible:px-2 focus-visible:py-1 focus-visible:text-xs focus-visible:shadow', className)}
          onClick={() => onOpenChange(true)}
          {...pointerHandlers}
        >
          Quick view — {course.title}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" collisionPadding={16} className="w-80" {...pointerHandlers}>
        <CoursePopoverContent course={course} titleId={titleId} />
      </PopoverContent>
    </Popover>
  );
}

export default CoursePopover;
