import privateClient from '@/lib/api/privateClient';

// privateClient (not publicClient) even for the guest-safe reads below:
// the reviews list and rating-summary endpoints use optionalAuth on the
// backend and personalize (userVoteStatus/isMine) whenever a token is
// present, so the client that actually attaches one is required for that
// to work. privateClient degrades to a plain guest request when there's no
// token — it never forces a redirect or a refresh on a 401 that never
// happens for these routes.

export async function getReviews(courseId, { page = 1, limit = 12, sort = 'recent' } = {}) {
  const res = await privateClient.get(`/courses/${courseId}/reviews`, { params: { page, limit, sort } });
  return res.data.data;
}

export async function getRatingSummary(courseId) {
  const res = await privateClient.get(`/courses/${courseId}/rating-summary`);
  return res.data.data;
}

export async function createReview(courseId, { rating, comment }) {
  const res = await privateClient.post(`/courses/${courseId}/reviews`, { rating, comment });
  return res.data.data;
}

export async function updateReview(courseId, { rating, comment }) {
  const res = await privateClient.patch(`/courses/${courseId}/reviews/mine`, { rating, comment });
  return res.data.data;
}

export async function deleteReview(courseId) {
  await privateClient.delete(`/courses/${courseId}/reviews/mine`);
}

export async function voteOnReview(reviewId, status) {
  const res = await privateClient.put(`/reviews/${reviewId}/vote`, { status });
  return res.data.data;
}

export async function getFeaturedReviews() {
  const res = await privateClient.get('/reviews/featured');
  return res.data.data.items;
}

export async function getPlatformStats() {
  const res = await privateClient.get('/stats/platform');
  return res.data.data;
}
