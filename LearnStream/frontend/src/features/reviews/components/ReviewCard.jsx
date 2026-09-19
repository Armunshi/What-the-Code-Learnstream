import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/relativeTime';
import { StarRating } from './StarRating.jsx';
import { ExpandableText } from './ExpandableText.jsx';
import { HelpfulVote } from './HelpfulVote.jsx';

const initials = (name) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export function ReviewCard({ courseId, review, onEdit, onDelete }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border p-4" data-testid="review-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={review.user?.avatar ?? undefined} alt="" />
            <AvatarFallback>{initials(review.user?.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium leading-tight">{review.user?.name}</p>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} size={13} />
              <span className="text-xs text-muted-foreground">{formatRelativeTime(review.createdAt)}</span>
            </div>
          </div>
        </div>

        {review.isMine && (
          <div className="flex shrink-0 gap-2 text-xs">
            <button type="button" onClick={onEdit} className="text-primary hover:underline">
              Edit
            </button>
            <button type="button" onClick={onDelete} className="text-destructive hover:underline">
              Delete
            </button>
          </div>
        )}
      </div>

      {review.comment ? <ExpandableText text={review.comment} /> : null}

      <HelpfulVote courseId={courseId} review={review} />
    </article>
  );
}

export default ReviewCard;
