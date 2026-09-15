import { HomePage } from './pages/HomePage.jsx';

// Registered at "/" for forward-compatibility with the route registry
// (docs/contracts/registries.md — app/router.jsx collects features/*/routes.jsx
// via import.meta.glob and is frozen after Wave 0, so this file is the only
// way CAT can add a route at all). It is currently UNREACHABLE in practice:
// app/router.jsx's own legacyRoutes array still declares "/" -> Pages/Home.jsx
// ahead of this registry, and React Router resolves two equally-specific "/"
// matches by array order. Pages/Home.jsx is therefore the real entry point
// today — it renders this same <HomePage/> directly (see its own comment) —
// and this route object starts working on its own, with no code change here,
// whenever a later wave's cleanup removes the legacy "/" entry from
// app/router.jsx.
const routes = [{ path: '/', element: <HomePage /> }];

export default routes;
