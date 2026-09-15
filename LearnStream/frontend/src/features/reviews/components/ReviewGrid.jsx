import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getReviews } from '../api.js';
import { reviewKeys } from '../queryKeys.js';
import { ReviewCard } from './ReviewCard.jsx';

const PAGE_SIZE = 12;

export function ReviewGrid({ courseId, sort, onEditReview, onDeleteReview }) {
  const query = useInfiniteQuery({
    queryKey: reviewKeys.list(courseId, { limit: PAGE_SIZE, sort }),
    queryFn: ({ pageParam = 1 }) => getReviews(courseId, { page: pageParam, limit: PAGE_SIZE, sort }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load reviews. Please try again.</p>;
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No reviews yet — be the first to review this course.</p>;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="review-grid">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((review) => (
          <ReviewCard
            key={review.id}
            courseId={courseId}
            review={review}
            onEdit={() => onEditReview?.(review)}
            onDelete={() => onDeleteReview?.(review)}
          />
        ))}
      </div>

      {query.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mx-auto"
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
        </Button>
      )}
    </div>
  );
}

export default ReviewGrid;
