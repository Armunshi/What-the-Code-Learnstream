import { getStorageItem, setStorageItem } from '@/lib/storage';

// "An anonymous searchSessionId (uuid, rotated after 30 min idle) is stored
// in localStorage for the query log" (plan §2.7). Read/rotated lazily on
// each call rather than kept in React state — every call site (GlobalSearch,
// SearchResultsPage) just needs "the current id" at the moment it fires a
// POST /courses/search/events, not a live subscription to it.
const STORAGE_KEY = 'learnstream:searchSessionId:v1';
const IDLE_ROTATE_MS = 30 * 60 * 1000;

function newSessionId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Returns the current search session id, rotating it first if the last
 * search was over 30 minutes ago. */
export function getSearchSessionId() {
  const now = Date.now();
  const stored = getStorageItem(STORAGE_KEY, null);

  if (!stored || !stored.id || !stored.lastUsedAt || now - stored.lastUsedAt > IDLE_ROTATE_MS) {
    const id = newSessionId();
    setStorageItem(STORAGE_KEY, { id, lastUsedAt: now });
    return id;
  }

  setStorageItem(STORAGE_KEY, { id: stored.id, lastUsedAt: now });
  return stored.id;
}

export default getSearchSessionId;
