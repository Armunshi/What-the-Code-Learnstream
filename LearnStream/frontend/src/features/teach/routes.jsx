// Registry entry (docs/contracts/registries.md) — collected by
// app/router.jsx's import.meta.glob, never wired up by hand there. No
// legacy route claims "/teach", so this is live immediately (unlike
// features/catalog/routes.jsx's shadowed "/").
const routes = [
  {
    path: 'teach',
    lazy: async () => {
      const { TeachPage } = await import('./TeachPage.jsx');
      return { Component: TeachPage };
    },
  },
];

export default routes;
