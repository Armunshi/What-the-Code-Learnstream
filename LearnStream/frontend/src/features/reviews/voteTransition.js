export const VOTE_STATUS = { HELPFUL: 'HELPFUL', UNHELPFUL: 'UNHELPFUL', NONE: 'NONE' };

// PUT /reviews/:reviewId/vote SETS whatever status the client sends — the
// server never toggles (D7, backend/src/services/reviews/reviews.service.js
// castVote). So the click handler, not the server, decides the transition:
// clicking the already-active button clears the vote, clicking the other
// one switches to it.
export function computeNextVoteStatus(currentStatus, clicked) {
  return currentStatus === clicked ? VOTE_STATUS.NONE : clicked;
}

export default computeNextVoteStatus;
