import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

// Overridable so that N parallel worktree lanes (Wave 1 runs ten of them at
// once) can each pick a distinct port pair and get a fully isolated e2e run
// instead of colliding on the historical defaults of 8000/2000. An unset
// environment reproduces exactly today's behaviour.
const E2E_BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? '8000';
const E2E_FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? '2000';

export const FRONTEND_URL = `http://localhost:${E2E_FRONTEND_PORT}`;
export const BACKEND_URL = `http://localhost:${E2E_BACKEND_PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // one shared fixture (course/student) — parallel workers would race on it
  workers: 1,
  retries: 0, // duplicate/race findings must not be masked by a retry silently passing
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 30_000,
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Builds once and serves the static build via `vite preview` instead of
  // running `vite dev`, so this run doesn't depend on HMR/Fast-Refresh
  // timing at all. `vite dev` runs React in development mode, where
  // StrictMode double-invokes effects (confirmed via captured network logs:
  // AuthProvider's refresh-on-mount fired twice per navigation under `vite
  // dev`, once under `vite preview`) — a real source of extra requests this
  // suite shouldn't have to account for. This does NOT fix every failure
  // seen against the current backend; see README.md "Current state" for a
  // separate, pre-existing rate-limiter issue this surfaced but didn't
  // cause (reproduces identically with a manually pre-started `vite dev`
  // server too, i.e. today's original documented workflow).
  // --strictPort makes the preview server fail fast when E2E_FRONTEND_PORT
  // is already taken rather than silently binding a different one, which
  // would otherwise produce confusing "frontend unreachable" failures
  // instead of a clear port-conflict error. VITE_BACKEND_URL must be present
  // for the build step too (Vite inlines VITE_-prefixed vars at build time,
  // not read at request time like `vite dev` does), which is why it's set
  // once here and applies to the whole command, build and preview alike.
  // Invoked via `npx vite ...` rather than `npm run build`/`npm run preview`
  // deliberately: frontend/package.json (owned by another lane, not this
  // one) has no "build" script today, only "dev" and "preview".
  webServer: {
    command: `npx vite build && npx vite preview --port ${E2E_FRONTEND_PORT} --strictPort`,
    cwd: FRONTEND_DIR,
    url: FRONTEND_URL,
    // Local reruns reuse an already-running preview server instead of
    // rebuilding every time; CI always starts fresh.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // a cold `vite build` is slower than `vite dev` ever was to become ready
    env: {
      ...process.env,
      VITE_BACKEND_URL: BACKEND_URL,
      // UPL's /__e2e__/upload-harness page (frontend/src/features/uploads/routes.jsx)
      // only exists in a build started with this set — the same "test-only
      // route, always on for the e2e build" posture as the backend's
      // MEDIA_PROVIDER=fake and E2E_TEST_ROUTES=1 above. Vite inlines
      // VITE_-prefixed vars at build time, so this has to be present for
      // the `vite build` half of the command, not just `vite preview`.
      VITE_E2E_HARNESS: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
