import { publicClient } from '@/lib/api/publicClient';

// Guest-facing reads only (plan §2.7, docs/contracts/api-conventions.md) —
// search never needs an authenticated identity, same reasoning as catalog's
// api.js.

export async function fetchTrending(signal) {
  const { data } = await publicClient.get('/courses/search/trending', { signal });
  return data.data.queries;
}

export async function fetchSuggestions(q, signal) {
  const { data } = await publicClient.get('/courses/search/suggest', { params: { q }, signal });
  return data.data;
}

// `filters` is the plain object useSearchFilters().filters returns — array
// values (lang/practice/topic/level/subs/price) serialize as repeated query
// params (`?lang=en&lang=hi`), which is what the backend's zod arrayParam
// preprocessor (validation/search.schemas.js) already accepts.
export async function fetchSearchResults(params, signal) {
  const { data } = await publicClient.get('/courses/search', {
    params,
    signal,
    paramsSerializer: { indexes: null },
  });
  return data.data;
}

export async function fetchRelatedSearches(q, signal) {
  const { data } = await publicClient.get('/courses/search/related', { params: { q }, signal });
  return data.data.queries;
}

export async function fetchFreshCourses(q, signal) {
  const { data } = await publicClient.get('/courses/search/fresh', { params: { q }, signal });
  return data.data.items;
}

// Fire-and-forget query-log write (D6: "204, rate-limited, no-store"). Never
// awaited by a caller that needs its result — a failed log write must never
// block or error out the search UI itself.
export async function postSearchEvent({ q, resultCount, sessionId }) {
  await publicClient.post('/courses/search/events', { q, resultCount, sessionId });
}
