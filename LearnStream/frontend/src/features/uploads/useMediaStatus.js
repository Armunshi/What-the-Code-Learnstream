import { useQuery } from '@tanstack/react-query';
import { fetchMediaStatus } from './api';

const POLL_INTERVAL_MS = 5000;

/**
 * D4's "useMediaStatus" — the read side of the upload pipeline. Reads the
 * CURRENT server status for one or more targets (an itemId, or the literal
 * "promo" for a course's promo video) and keeps polling every 5s as long as
 * any of them is still PROCESSING, so a reload mid-transcode picks the
 * right state back up (GET media-status itself does the fake-provider
 * always-reconcile / real-provider stuck-past-60s reconcile — this hook
 * just calls it on a schedule).
 *
 * `ids` should be a stable array reference (e.g. from useMemo) — a new
 * array identity every render would defeat react-query's query-key caching
 * and refetch on every render instead of on the interval.
 */
export function useMediaStatus(courseId, ids, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['media-status', courseId, ids],
    queryFn: () => fetchMediaStatus(courseId, ids),
    enabled: enabled && Boolean(courseId) && ids.length > 0,
    refetchInterval: (query) => {
      const items = query.state.data;
      if (!items) return false;
      return items.some((item) => item.status === 'PROCESSING') ? POLL_INTERVAL_MS : false;
    },
  });

  const byId = {};
  for (const item of query.data ?? []) {
    byId[item.id] = item;
  }

  return { statusById: byId, isLoading: query.isLoading, refetch: query.refetch };
}
