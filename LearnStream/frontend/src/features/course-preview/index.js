// Public API surface of the course-preview feature (docs/lanes/prev.json
// owns features/course-preview/**). W0-A creates this barrel with a
// placeholder body for the frozen `PreviewBanner` stub
// (docs/contracts/stubs.md): renders "Preview — not published · Back to
// editing" when a course is viewed via ?preview=guest or
// /learn/:id?preview=1. PREV replaces this body in Wave 2 (not Wave 1, per
// the stub ownership table) — the banner takes no props beyond what it
// reads from the URL itself.
export function PreviewBanner() {
  return null;
}
