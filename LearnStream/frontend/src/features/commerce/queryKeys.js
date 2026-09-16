// Each feature owns its own query keys (plan §2.1). 'cart' and 'meSummary'
// are deliberately plain root keys — not persisted (lib/queryClient.js's
// PERSISTED_QUERY_KEYS allowlist excludes them on purpose, plan §2.1: cart
// is per-user, fast-changing data) — and 'meSummary' is the literal key
// displayRazorpay's success path and PurchaseCta's enrollment check both
// invalidate/read, so any other lane that later builds the UserMenu "N
// courses enrolled" widget against GET /users/me/summary should reuse this
// same key rather than inventing a second one for the same endpoint.
export const cartKeys = {
  all: ['cart'],
};

export const meSummaryKeys = {
  all: ['meSummary'],
};
