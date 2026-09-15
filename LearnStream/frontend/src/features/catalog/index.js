// Public API surface of the catalog feature (docs/lanes/cat.json owns
// features/catalog/**). W0-A creates this barrel with placeholder bodies for
// the two frozen stubs assigned to CAT (docs/contracts/stubs.md): CourseCard
// and CourseGrid (and the CoursePopover built alongside CourseCard, per the
// contract doc's note that it ships together with the card). CAT replaces
// only these bodies in Wave 1 — the signatures are frozen.
//
// No JSX literals here on purpose: this file is `index.js`, not `.jsx`, and
// Vite's build-time import analysis requires literal JSX syntax to live in
// a `.jsx`/`.tsx` file. `null` is an explicitly acceptable placeholder body
// per docs/contracts/stubs.md.

// CourseCard({course, priority, showPopover}) — an <article
// data-testid="course-card"> linking to /course/:id, containing CourseThumb,
// title, author, RatingStars, Price, Badge, and a sr-only "Quick view"
// button that opens CoursePopover. All data comes from one CourseCardDTO —
// no second fetch on hover (see docs/contracts/dto.md).
export function CourseCard({ course, priority = false, showPopover = true }) {
  void course;
  void priority;
  void showPopover;
  return null;
}

// CourseGrid — lays out a list of CourseCardDTOs. Placeholder body only.
export function CourseGrid({ courses = [] }) {
  void courses;
  return null;
}
