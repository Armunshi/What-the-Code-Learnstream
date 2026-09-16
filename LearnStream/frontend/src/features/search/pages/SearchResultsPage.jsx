import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSearchResults, fetchRelatedSearches, fetchFreshCourses, postSearchEvent } from '../api.js';
import { searchKeys } from '../queryKeys.js';
import { useSearchFilters } from '../useSearchFilters.js';
import { getSearchSessionId } from '../useSearchSession.js';
import { GlobalSearch } from '../components/GlobalSearch.jsx';
import { QuickFilterBar } from '../components/QuickFilterBar.jsx';
import { AllFiltersPanel } from '../components/AllFiltersPanel.jsx';
import { ActiveFilterChips } from '../components/ActiveFilterChips.jsx';
import { ResultCount } from '../components/ResultCount.jsx';
import { SortSelect } from '../components/SortSelect.jsx';
import { SpotlightCard } from '../components/SpotlightCard.jsx';
import { NoResultsState } from '../components/NoResultsState.jsx';
import { RelatedSearches } from '../components/RelatedSearches.jsx';
import { HotAndFreshCarousel } from '../components/HotAndFreshCarousel.jsx';
import { CourseGrid } from '@/features/catalog';
import { CourseGridSkeleton } from '@/components/common/Skeletons';
import { ErrorState } from '@/components/common/ErrorState';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = 12;

/**
 * `/courses/search` (FR-SRC-2.1, plan §4 W1-SRC). Filters are entirely
 * URL-driven via useSearchFilters() (§2.7) — this page never keeps its own
 * copy of what's selected, it only reads `filters` and passes the mutators
 * straight through to QuickFilterBar/AllFiltersPanel/ActiveFilterChips.
 */
export function SearchResultsPage() {
  const {
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
  } = useSearchFilters();
  const [allFiltersOpen, setAllFiltersOpen] = useState(false);

  const searchParams = { ...filters, limit: PAGE_SIZE };
  const resultsQuery = useQuery({
    queryKey: searchKeys.results(searchParams),
    queryFn: ({ signal }) => fetchSearchResults(searchParams, signal),
    placeholderData: keepPreviousData,
  });

  const trimmedQuery = filters.q.trim();

  const relatedQuery = useQuery({
    queryKey: searchKeys.related(trimmedQuery),
    queryFn: ({ signal }) => fetchRelatedSearches(trimmedQuery, signal),
    enabled: trimmedQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const freshQuery = useQuery({
    queryKey: searchKeys.fresh(trimmedQuery),
    queryFn: ({ signal }) => fetchFreshCourses(trimmedQuery, signal),
    staleTime: 5 * 60 * 1000,
  });

  // Fires the query-log write once per settled (q, total) pair — not on
  // every render, and never for an empty query (searchEventSchema requires
  // q.min(1)). Intentionally not awaited by anything the UI depends on
  // (plan §2.7 / D6): a failed log write must never surface as a search
  // error.
  const loggedRef = useRef('');
  useEffect(() => {
    if (!trimmedQuery || resultsQuery.data === undefined) return;
    const key = `${trimmedQuery}:${resultsQuery.data.total}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    postSearchEvent({ q: trimmedQuery, resultCount: resultsQuery.data.total, sessionId: getSearchSessionId() }).catch(() => {});
  }, [trimmedQuery, resultsQuery.data]);

  if (resultsQuery.isError) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 py-10">
        <ErrorState description="Couldn't load search results." onRetry={resultsQuery.refetch} />
      </div>
    );
  }

  const total = resultsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showNoResults = resultsQuery.isSuccess && total === 0;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6" data-testid="search-results-page">
      <div className="mb-4 max-w-md">
        <GlobalSearch variant="inline" />
      </div>

      <QuickFilterBar
        filters={filters}
        facets={resultsQuery.data?.facets}
        toggleValue={toggleValue}
        setRadio={setRadio}
        onOpenAllFilters={() => setAllFiltersOpen(true)}
      />

      <ActiveFilterChips
        filters={filters}
        removeValue={removeValue}
        clearRadio={clearRadio}
        setCert={setCert}
        hasActiveFilters={hasActiveFilters}
        clearAll={clearAll}
      />

      <div className="mt-4 flex gap-6">
        <AllFiltersPanel
          open={allFiltersOpen}
          onOpenChange={setAllFiltersOpen}
          filters={filters}
          facets={resultsQuery.data?.facets}
          toggleValue={toggleValue}
          setRadio={setRadio}
          setCert={setCert}
          hasActiveFilters={hasActiveFilters}
          clearAll={clearAll}
        />

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <ResultCount total={total} />
            <SortSelect value={filters.sort} onChange={setSort} />
          </div>

          {resultsQuery.data?.spotlight ? (
            <div className="mb-6">
              <SpotlightCard spotlight={resultsQuery.data.spotlight} />
            </div>
          ) : null}

          {resultsQuery.isLoading ? (
            <CourseGridSkeleton />
          ) : showNoResults ? (
            <NoResultsState query={trimmedQuery} hasActiveFilters={hasActiveFilters} clearAll={clearAll} />
          ) : (
            <>
              <CourseGrid courses={resultsQuery.data?.items ?? []} />

              {totalPages > 1 ? (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (filters.page > 1) setPage(filters.page - 1);
                        }}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-2 text-sm text-muted-foreground">
                        Page {filters.page} of {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (filters.page < totalPages) setPage(filters.page + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </>
          )}

          {relatedQuery.data?.length > 0 ? (
            <div className="mt-8">
              <RelatedSearches queries={relatedQuery.data} onSelect={setQuery} />
            </div>
          ) : null}

          {freshQuery.data?.length > 0 ? (
            <div className="mt-8">
              <HotAndFreshCarousel items={freshQuery.data} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SearchResultsPage;
