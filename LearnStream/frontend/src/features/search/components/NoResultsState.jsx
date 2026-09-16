import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';

/** "A zero-result combination shows NoResultsState with a Clear filters
 * action" (plan §6.3) — `hasActiveFilters` decides whether that action is
 * "clear filters" (a bad filter combo) or just "no matches at all". */
export function NoResultsState({ query, hasActiveFilters, clearAll }) {
  return (
    <div data-testid="no-results-state">
      <EmptyState
        icon={SearchX}
        title={query ? `No results for "${query}"` : 'No results'}
        description={
          hasActiveFilters
            ? 'Try removing some filters, or search for something else.'
            : 'Try a different search term.'
        }
        action={
          hasActiveFilters ? (
            <Button type="button" variant="outline" size="sm" data-testid="no-results-clear-filters" onClick={clearAll}>
              Clear filters
            </Button>
          ) : null
        }
        className="my-10"
      />
    </div>
  );
}

export default NoResultsState;
