// 'categories' matches lib/queryClient.js's PERSISTED_QUERY_KEYS allowlist
// exactly (same root key CAT's own features/catalog/queryKeys.js uses for
// the same GET /courses/categories data), so ExploreMenu's fetch shares a
// cache entry with CategoryTabs instead of duplicating the request, and
// survives a reload (H-NFR-1.3).
export const categoriesKeys = {
  all: ['categories'],
};

export const meSummaryKeys = {
  all: ['meSummary'],
};
