// Public API surface of the wishlist feature (docs/lanes/acc.json owns
// features/wishlist/**). W0-A creates this barrel with a placeholder body
// for the frozen `WishlistButton` stub (docs/contracts/stubs.md): used both
// standalone (course page) and inside CoursePopover — same component, icon
// only, no popover-specific variant. ACC replaces only this body in Wave 1.
export function WishlistButton({ courseId }) {
  void courseId;
  return null;
}
