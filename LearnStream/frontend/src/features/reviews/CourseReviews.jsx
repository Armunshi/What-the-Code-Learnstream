import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount } from '@/lib/format';
import useRequireAuth from '@/features/auth/useRequireAuth.jsx';
import { deleteReview, getRatingSummary } from './api.js';
import { reviewKeys } from './queryKeys.js';
import { normalizeApiError } from '@/lib/api/errors';
import { StarRating } from './components/StarRating.jsx';
import { RatingDistribution } from './components/RatingDistribution.jsx';
import { ReviewGrid } from './components/ReviewGrid.jsx';
import { ReviewForm } from './components/ReviewForm.jsx';

// Compact header form, e.g. "4.7 ★ (3,779 ratings) 56,145 students"
// (FR-REV-1.1). `stats` is the course's own stats subdocument
// (backend/src/models/course.model.js), already fetched by whichever page
// renders the course header — this never fetches on its own.
export function CourseRatingHeaderMetric({ courseId, stats }) {
  if (!stats || !stats.ratingCount) return null;

  return (
    <a
      href={`/course/${courseId}#reviews`}
      className="inline-flex items-center gap-1.5 text-sm hover:underline"
      data-testid="course-rating-header-metric"
    >
      <span className="font-semibold">{(Number(stats.ratingAvg) || 0).toFixed(1)}</span>
      <StarRating rating={stats.ratingAvg} size={14} />
      <span className="text-muted-foreground">({formatCount(stats.ratingCount)} ratings)</span>
      <span className="text-muted-foreground">{formatCount(stats.enrollmentCount)} students</span>
    </a>
  );
}

// Full section: header, RatingDistribution, ReviewGrid, HelpfulVote (inside
// each ReviewCard), "Show more reviews" (inside ReviewGrid), and ReviewForm.
export function CourseReviewsSection({ courseId }) {
  const queryClient = useQueryClient();
  const { requireAuth } = useRequireAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const summaryQuery = useQuery({
    queryKey: reviewKeys.ratingSummary(courseId),
    queryFn: () => getRatingSummary(courseId),
    enabled: Boolean(courseId),
  });

  const openCreate = () => requireAuth(() => setFormOpen(true));
  const openEdit = (review) => {
    setEditingReview(review);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditingReview(null);
  };

  const handleDelete = async () => {
    try {
      await deleteReview(courseId);
      queryClient.invalidateQueries({ queryKey: ['reviews', 'list', courseId] });
      queryClient.invalidateQueries({ queryKey: reviewKeys.ratingSummary(courseId) });
      toast.success('Review deleted');
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    }
  };

  return (
    <section id="reviews" className="flex flex-col gap-6" data-testid="course-reviews-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Student reviews</h2>
        <Button onClick={openCreate}>Write a review</Button>
      </div>

      {summaryQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : summaryQuery.data ? (
        <RatingDistribution
          averageRating={summaryQuery.data.averageRating}
          totalRatingsCount={summaryQuery.data.totalRatingsCount}
          distribution={summaryQuery.data.ratingDistribution}
        />
      ) : null}

      <ReviewGrid courseId={courseId} sort="recent" onEditReview={openEdit} onDeleteReview={handleDelete} />

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReview ? 'Update your review' : 'Write a review'}</DialogTitle>
          </DialogHeader>
          <ReviewForm courseId={courseId} existingReview={editingReview} onSuccess={closeForm} onCancel={closeForm} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
