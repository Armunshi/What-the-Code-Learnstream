import { Search } from 'lucide-react';

/** Related-searches list (FR-SRC-4.1, rule-based — services/search/related.js's
 * co-occurrence → prefix/token overlap → topic-label cascade). Clicking one
 * re-runs the search with that query, same as picking a suggestion. */
export function RelatedSearches({ queries = [], onSelect }) {
  if (queries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="related-searches">
      <h3 className="text-sm font-semibold text-foreground">Related searches</h3>
      <div className="flex flex-wrap gap-2">
        {queries.map((q) => (
          <button
            key={q}
            type="button"
            data-testid="related-search-item"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            onClick={() => onSelect(q)}
          >
            <Search className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RelatedSearches;
