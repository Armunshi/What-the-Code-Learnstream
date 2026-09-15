// Public API surface of the search feature (docs/lanes/src.json owns
// features/search/**). W0-A creates this barrel with a placeholder body for
// the frozen `GlobalSearch({variant})` stub (docs/contracts/stubs.md). SRC
// replaces only this body in Wave 1 — the signature (and the behavior
// contract described alongside it) is frozen.
export function GlobalSearch({ variant = 'inline' }) {
  void variant;
  return null;
}
