import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { DURATION_VALUES, RATING_VALUES, SORT_VALUES } from './filterConfig.js';

// D6/§2.7/§6.3: "The URL is the single filter state." Every consumer
// (QuickFilterBar, AllFiltersPanel, ActiveFilterChips, SearchResultsPage)
// reads and writes through this one hook, backed by useSearchParams —
// nothing here keeps its own copy of filter state, so the two filter UIs
// can never drift out of sync with each other (FR-SRC-3.2 criterion 6).
const filtersSchema = z.object({
  q: z.string().catch(''),
  cert: z.boolean().catch(false),
  rating: z.enum(RATING_VALUES).optional().catch(undefined),
  lang: z.array(z.string()).catch([]),
  practice: z.array(z.string()).catch([]),
  duration: z.enum(DURATION_VALUES).optional().catch(undefined),
  topic: z.array(z.string()).catch([]),
  level: z.array(z.string()).catch([]),
  subs: z.array(z.string()).catch([]),
  price: z.array(z.string()).catch([]),
  sort: z.enum(SORT_VALUES).catch('relevant'),
  page: z.coerce.number().int().min(1).catch(1),
});

const ARRAY_KEYS = ['lang', 'practice', 'topic', 'level', 'subs', 'price'];

function parse(searchParams) {
  const raw = {
    q: searchParams.get('q') ?? '',
    cert: searchParams.get('cert') === 'true' || searchParams.get('cert') === '1',
    rating: searchParams.get('rating') ?? undefined,
    duration: searchParams.get('duration') ?? undefined,
    sort: searchParams.get('sort') ?? 'relevant',
    page: searchParams.get('page') ?? '1',
  };
  for (const key of ARRAY_KEYS) raw[key] = searchParams.getAll(key);
  return filtersSchema.parse(raw);
}

/** Builds the URLSearchParams a given filters object serializes to — the
 * inverse of parse(), and what every mutator below funnels through so
 * "clear this one value" / "toggle this checkbox" / "replace the radio
 * value" all end up producing the exact same canonical query string. */
function serialize(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.cert) params.set('cert', 'true');
  if (filters.rating) params.set('rating', filters.rating);
  if (filters.duration) params.set('duration', filters.duration);
  if (filters.sort && filters.sort !== 'relevant') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  for (const key of ARRAY_KEYS) {
    for (const value of filters[key] ?? []) params.append(key, value);
  }
  return params;
}

export function useSearchFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parse(searchParams), [searchParams]);

  // Every mutator pushes a new history entry (react-router's default, no
  // {replace:true}) — Back/Forward restoring filter state (FR-SRC-3.2 #11)
  // and a refresh reproducing it (#10) both fall out of that for free, since
  // the URL itself IS the state.
  const apply = useCallback(
    (next) => {
      setSearchParams(serialize(next));
    },
    [setSearchParams]
  );

  const setQuery = useCallback((q) => apply({ ...filters, q, page: 1 }), [filters, apply]);

  const setSort = useCallback((sort) => apply({ ...filters, sort, page: 1 }), [filters, apply]);

  const setPage = useCallback((page) => apply({ ...filters, page }), [filters, apply]);

  const setCert = useCallback((cert) => apply({ ...filters, cert, page: 1 }), [filters, apply]);

  /** Radio-style group (rating/duration): picking a new value REPLACES the
   * old one; picking the already-active value clears it. */
  const setRadio = useCallback(
    (key, value) => apply({ ...filters, [key]: filters[key] === value ? undefined : value, page: 1 }),
    [filters, apply]
  );

  /** Checkbox-style group: OR within the group (FR-SRC-3.2's own "Combining
   * filters" rule) — toggling one value never touches the others. */
  const toggleValue = useCallback(
    (key, value) => {
      const current = filters[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      apply({ ...filters, [key]: next, page: 1 });
    },
    [filters, apply]
  );

  /** Removes one value from a checkbox group's active pill (its own X) —
   * distinct from toggleValue only in that it's idempotent (never re-adds). */
  const removeValue = useCallback(
    (key, value) => apply({ ...filters, [key]: (filters[key] ?? []).filter((v) => v !== value), page: 1 }),
    [filters, apply]
  );

  const clearRadio = useCallback((key) => apply({ ...filters, [key]: undefined, page: 1 }), [filters, apply]);

  /** Clear all — keeps the text query (still "a search"), drops every filter/sort/page. */
  const clearAll = useCallback(() => apply({ ...filtersSchema.parse({}), q: filters.q }), [filters, apply]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(filters.cert) ||
      Boolean(filters.rating) ||
      Boolean(filters.duration) ||
      ARRAY_KEYS.some((key) => (filters[key] ?? []).length > 0),
    [filters]
  );

  return {
    filters,
    setQuery,
    setSort,
    setPage,
    setCert,
    setRadio,
    toggleValue,
    removeValue,
    clearRadio,
    clearAll,
    hasActiveFilters,
  };
}

export default useSearchFilters;
