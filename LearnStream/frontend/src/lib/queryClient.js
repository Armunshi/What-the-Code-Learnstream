import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { toast } from 'sonner';
import { normalizeApiError } from './api/errors';

// Wired into the QueryCache below, per plan §2.1 (H-NFR-3.1).
function handleGlobalQueryError(error) {
  const normalized = normalizeApiError(error);
  toast.error(normalized.message);
}

// One shared QueryClient for the whole app (plan §2.1). Errors surface as a
// sonner toast here so individual queries don't each need their own error
// side effect; components still render ErrorState + Retry from their own
// query result for the in-place UI.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: handleGlobalQueryError,
  }),
});

// Only these four query keys are worth persisting across a reload: they're
// the public, mostly-static data that makes the homepage/catalog feel warm
// on a cold start (H-NFR-1.3), rather than per-user or fast-changing data
// (cart, auth, search results) that would go stale or leak between users if
// it survived in localStorage.
const PERSISTED_QUERY_KEYS = new Set(['catalog', 'categories', 'stats', 'featuredReviews']);

function isPersistedQuery(queryKey) {
  const [rootKey] = Array.isArray(queryKey) ? queryKey : [queryKey];
  return PERSISTED_QUERY_KEYS.has(rootKey);
}

// A build-id buster invalidates every persisted cache entry the moment a new
// version ships, so a stale shape from before a DTO change can never be
// read back after a deploy. VITE_BUILD_ID is expected to be set by the
// deploy pipeline; falling back to "dev" is fine locally, where there's no
// persisted-cache-vs-code-drift risk worth guarding against.
const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'dev';

export function setupQueryPersistence() {
  if (typeof window === 'undefined') return;

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'learnstream:queryCache:v1',
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24h
    buster: BUILD_ID,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => isPersistedQuery(query.queryKey),
    },
  });
}

export default queryClient;
