// Public API surface of the nav feature (docs/lanes/nav.json owns
// features/nav/**). components/layout/SiteHeader/** consumes this barrel
// rather than reaching into features/nav/hooks or features/nav/api
// directly, matching the "a feature imports only from ... other features'
// index.js" rule (plan §1.1) even though SiteHeader and this feature share
// the same lane.
export { useCategories } from './hooks/useCategories.js';
export { useCurrentUser, getInitials } from './hooks/useCurrentUser.js';
export { useLogout } from './hooks/useLogout.js';
