// Each feature owns its own query keys (plan §2.1) — 'catalog' and
// 'categories' as root keys match lib/queryClient.js's PERSISTED_QUERY_KEYS
// allowlist exactly, so these two queries survive a reload (H-NFR-1.3).
export const catalogKeys = {
  all: ['catalog'],
  list: (params) => ['catalog', params],
};

export const categoriesKeys = {
  all: ['categories'],
};
