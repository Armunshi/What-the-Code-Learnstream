import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CourseThumb } from '@/components/common/CourseThumb';
import { RatingStars } from '@/components/common/RatingStars';
import { Price } from '@/components/common/Price';
import { Badge } from '@/components/ui/badge';
import { useHoverIntent } from '@/hooks/useHoverIntent';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CoursePopover } from './CoursePopover';
import { useCoursePopoverGroup } from './CoursePopoverGroup';

const BADGE_LABELS = {
  bestseller: 'Bestseller',
  highest_rated: 'Highest Rated',
  new: 'New',
};

/**
 * CourseCard({course, priority, showPopover}) (docs/contracts/stubs.md,
 * plan §5.2) — frozen signature, this is CAT's Wave 1 body.
 */
export function CourseCard({ course, priority = false, showPopover = true }) {
  const titleId = useId();
  const triggerRef = useRef(null);
  const hoverIntent = useHoverIntent({ openDelay: 150, closeDelay: 150 });
  const group = useCoursePopoverGroup();
  // Popover is mouse-only (H-FR-2.1) — a coarse/no-hover pointer (touch) gets
  // no popover at all, just the card's own Link navigating on tap.
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const popoverEnabled = showPopover && canHover;

  const isOpen = popoverEnabled && hoverIntent.isOpen && (!group || group.openId === course.id);

  useEffect(() => {
    if (!popoverEnabled || !group) return;
    if (hoverIntent.isOpen) group.requestOpen(course.id);
    else group.requestClose(course.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverIntent.isOpen, popoverEnabled]);

  const handlePointerEnter = (event) => {
    if (!popoverEnabled) return;
    // "Re-hovering another card within 300ms skips the open delay."
    if (group?.recentlyClosed() && group.openId !== course.id) {
      hoverIntent.open();
      return;
    }
    hoverIntent.pointerHandlers.onPointerEnter(event);
  };

  const handlePointerLeave = (event) => {
    if (!popoverEnabled) return;
    hoverIntent.pointerHandlers.onPointerLeave(event);
  };

  const handleOpenChange = (next) => {
    if (next) hoverIntent.open();
    else hoverIntent.close();
  };

  return (
    <article
      data-testid="course-card"
      className="relative flex flex-col gap-2"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Link to={`/course/${course.id}`} className="flex flex-col gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <CourseThumb src={course.thumbnailUrl} alt="" priority={priority} />
        <div className="flex flex-col gap-1">
          {course.badge ? (
            <Badge variant="secondary" className="w-fit">
              {BADGE_LABELS[course.badge] ?? course.badge}
            </Badge>
          ) : null}
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{course.title}</h3>
          <p className="text-xs text-muted-foreground">{course.author?.name}</p>
          {course.rating?.count > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-amber-700">{course.rating.avg.toFixed(1)}</span>
              <RatingStars rating={course.rating.avg} size={12} />
              <span className="text-xs text-muted-foreground">({formatCount(course.rating.count)})</span>
            </div>
          ) : null}
          <Price price={course.priceInPaise} className="text-sm" />
        </div>
      </Link>

      {popoverEnabled ? (
        <CoursePopover
          course={course}
          open={isOpen}
          onOpenChange={handleOpenChange}
          triggerRef={triggerRef}
          pointerHandlers={{ onPointerEnter: handlePointerEnter, onPointerLeave: handlePointerLeave }}
          titleId={titleId}
          className={cn('absolute right-2 top-2')}
        />
      ) : null}
    </article>
  );
}

export default CourseCard;
