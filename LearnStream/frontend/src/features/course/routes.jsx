// Registered via the route registry (docs/contracts/registries.md). Unlike
// features/catalog/routes.jsx's "/" (currently shadowed by the legacy
// Home route), no legacy route claims "/course/:courseId" today, so this one
// is live immediately. Uses React Router's `lazy` per plan §7 ("route-level
// lazy for every route except Home") so CourseDetailPage's chunk — and
// everything it pulls in (VideoPlayer, hls.js transitively, the accordion/
// dialog primitives) — only loads when a visitor actually opens a course
// page, not as part of the initial bundle.
const routes = [
  {
    path: '/course/:courseId',
    lazy: async () => {
      const { CourseDetailPage } = await import('./pages/CourseDetailPage.jsx');
      return { Component: CourseDetailPage };
    },
  },
];

export default routes;
