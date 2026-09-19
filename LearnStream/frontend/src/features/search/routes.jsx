import { SearchResultsPage } from './pages/SearchResultsPage.jsx';

// docs/lanes/src.json's one `appends` entry to the route registry
// (app/router.jsx collects features/*/routes.jsx via import.meta.glob —
// frozen after Wave 0, see catalog/routes.jsx's own comment for why this is
// the only way to add a route at all). The plural `/courses/search`
// (FR-SRC-2.1) can never collide with the legacy singular
// `/courses/:courseId` catch-all.
const routes = [{ path: '/courses/search', element: <SearchResultsPage /> }];

export default routes;
