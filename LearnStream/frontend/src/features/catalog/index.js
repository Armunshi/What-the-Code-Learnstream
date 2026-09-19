// Public API surface of the catalog feature (docs/lanes/cat.json owns
// features/catalog/**). Replaces W0-A's placeholder bodies for the two
// frozen stubs assigned to CAT (docs/contracts/stubs.md): CourseCard and
// CourseGrid (and the CoursePopover built alongside CourseCard). The
// signatures below are unchanged from Wave 0 — only the bodies moved to
// components/ and are re-exported here.
export { CourseCard } from './components/CourseCard.jsx';
export { CourseGrid } from './components/CourseGrid.jsx';
export { CoursePopover, CoursePopoverContent } from './components/CoursePopover.jsx';
export { CoursePopoverGroup, useCoursePopoverGroup } from './components/CoursePopoverGroup.jsx';
export { CategoryTabs } from './components/CategoryTabs.jsx';
