// 'featuredReviews' and 'stats' root keys are deliberately what
// lib/queryClient.js's PERSISTED_QUERY_KEYS already anticipates — the
// homepage social-proof widgets should feel warm on a cold start (H-NFR-1.3)
// the same way catalog/categories do.
export const reviewKeys = {
  list: (courseId, params = {}) => ['reviews', 'list', courseId, params],
  ratingSummary: (courseId) => ['reviews', 'ratingSummary', courseId],
  mine: (courseId) => ['reviews', 'mine', courseId],
  featured: () => ['featuredReviews'],
  platformStats: () => ['stats', 'platform'],
};

export default reviewKeys;
