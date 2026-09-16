// Public API surface of the search feature (docs/lanes/src.json owns
// features/search/**). W0-A created this barrel with a placeholder body for
// the frozen `GlobalSearch({variant})` stub (docs/contracts/stubs.md); this
// is SRC's Wave 1 replacement — the signature (and the behavior contract
// described alongside it) is unchanged, only the body moved to
// components/GlobalSearch.jsx. `useSearchFilters` is exported too since
// NAV/other lanes consuming GlobalSearch have no reason to reach into
// components/ directly.
export { GlobalSearch } from './components/GlobalSearch.jsx';
export { useSearchFilters } from './useSearchFilters.js';
