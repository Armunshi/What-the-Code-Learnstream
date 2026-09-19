import { lazy } from 'react';

// Registry entry (docs/contracts/registries.md — app/router.jsx collects
// every features/*/routes.jsx via import.meta.glob). The harness route only
// exists in a build started with VITE_E2E_HARNESS=1 (Vite inlines this at
// build time, not read per-request — see e2e/playwright.config.ts's
// webServer.env), so it can never appear in a production bundle regardless
// of what's deployed.
const routes =
  import.meta.env.VITE_E2E_HARNESS === '1'
    ? [
        {
          path: '__e2e__/upload-harness',
          Component: lazy(() => import('./harness/UploadHarnessPage.jsx')),
        },
      ]
    : [];

export default routes;
