import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import useRequireAuth from '@/features/auth/useRequireAuth.jsx';
import { voteOnReview } from '../api.js';
import { computeNextVoteStatus, VOTE_STATUS } from '../voteTransition.js';

// Rewrites the review everywhere it's cached — ReviewGrid's list is an
// infinite query ({pages: [{items}, ...]}) — so every mounted page reflects
// the same vote immediately, without knowing which page currently holds it.
function patchReviewInLists(queryClient, courseId, reviewId, patch) {
  queryClient.setQueriesData({ queryKey: ['reviews', 'list', courseId] }, (old) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === reviewId ? { ...item, ...patch } : item)),
      })),
    };
  });
}

// Voting on your own review is rejected server-side (D7) — isMine hides the
// control entirely rather than surfacing a 403 a viewer can't act on.
export function HelpfulVote({ courseId, review }) {
  const queryClient = useQueryClient();
  const { requireAuth } = useRequireAuth();
  const { id: reviewId, helpfulCount, unhelpfulCount, userVoteStatus, isMine } = review;

  const mutation = useMutation({
    mutationFn: (status) => voteOnReview(reviewId, status),
    onMutate: async (clickedStatus) => {
      await queryClient.cancelQueries({ queryKey: ['reviews', 'list', courseId] });
      const nextStatus = computeNextVoteStatus(userVoteStatus, clickedStatus);
      const wasHelpful = userVoteStatus === VOTE_STATUS.HELPFUL;
      const wasUnhelpful = userVoteStatus === VOTE_STATUS.UNHELPFUL;
      const nextHelpful = helpfulCount + (nextStatus === VOTE_STATUS.HELPFUL ? 1 : 0) - (wasHelpful ? 1 : 0);
      const nextUnhelpful =
        unhelpfulCount + (nextStatus === VOTE_STATUS.UNHELPFUL ? 1 : 0) - (wasUnhelpful ? 1 : 0);

      patchReviewInLists(queryClient, courseId, reviewId, {
        userVoteStatus: nextStatus,
        helpfulCount: nextHelpful,
        unhelpfulCount: nextUnhelpful,
      });

      return { previous: { userVoteStatus, helpfulCount, unhelpfulCount } };
    },
    onError: (_err, _status, context) => {
      if (context?.previous) {
        patchReviewInLists(queryClient, courseId, reviewId, context.previous);
      }
    },
    onSuccess: (result) => {
      patchReviewInLists(queryClient, courseId, reviewId, result);
    },
  });

  if (isMine) return null;

  const cast = (status) => requireAuth(() => mutation.mutate(status));

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="helpful-vote">
      <span>Was this helpful?</span>
      <button
        type="button"
        onClick={() => cast(VOTE_STATUS.HELPFUL)}
        disabled={mutation.isPending}
        aria-pressed={userVoteStatus === VOTE_STATUS.HELPFUL}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted',
          userVoteStatus === VOTE_STATUS.HELPFUL && 'font-medium text-primary'
        )}
      >
        <ThumbsUp width={14} height={14} /> {helpfulCount}
      </button>
      <button
        type="button"
        onClick={() => cast(VOTE_STATUS.UNHELPFUL)}
        disabled={mutation.isPending}
        aria-pressed={userVoteStatus === VOTE_STATUS.UNHELPFUL}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted',
          userVoteStatus === VOTE_STATUS.UNHELPFUL && 'font-medium text-primary'
        )}
      >
        <ThumbsDown width={14} height={14} /> {unhelpfulCount}
      </button>
    </div>
  );
}

export default HelpfulVote;
