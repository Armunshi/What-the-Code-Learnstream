import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { normalizeApiError } from '@/lib/api/errors';
import { createReview, updateReview } from '../api.js';
import { reviewKeys } from '../queryKeys.js';
import { cn } from '@/lib/utils';

// Mirrors backend/src/validation/review.schemas.js (D7: 1.0-5.0 in 0.5
// steps) using zod v3's errorMap-free API — the frontend package is zod v3,
// unlike the backend's v4, so custom messages are plain options objects.
const reviewFormSchema = z.object({
  rating: z
    .number({ invalid_type_error: 'Choose a rating' })
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5')
    .refine((v) => Number.isInteger(v * 2), { message: 'Rating must be in 0.5 steps' }),
  comment: z.string().max(2000, 'Review must be at most 2000 characters').optional().default(''),
});

const RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function RatingPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Rating">
      {RATING_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted',
            value === option && 'border-primary bg-primary/10 text-primary'
          )}
        >
          <Star width={14} height={14} fill={value >= option ? 'currentColor' : 'none'} />
          {option}
        </button>
      ))}
    </div>
  );
}

// existingReview present -> edit mode (PATCH); absent -> create (POST).
export function ReviewForm({ courseId, existingReview, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: existingReview?.rating ?? undefined,
      comment: existingReview?.comment ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values) => (existingReview ? updateReview(courseId, values) : createReview(courseId, values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'list', courseId] });
      queryClient.invalidateQueries({ queryKey: reviewKeys.ratingSummary(courseId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.mine(courseId) });
      toast.success(existingReview ? 'Review updated' : 'Review posted');
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(normalizeApiError(error).message);
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col gap-3"
      data-testid="review-form"
    >
      <Controller
        name="rating"
        control={control}
        render={({ field }) => <RatingPicker value={field.value} onChange={field.onChange} />}
      />
      {errors.rating && <p className="text-xs text-destructive">{errors.rating.message}</p>}

      <Textarea
        {...register('comment')}
        placeholder="Share what you learned and how the course helped you (optional)"
        rows={4}
      />
      {errors.comment && <p className="text-xs text-destructive">{errors.comment.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : existingReview ? 'Update review' : 'Post review'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default ReviewForm;
