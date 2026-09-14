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
  // Starts the Vite dev server for this run instead of requiring it to be
  // started manually beforehand. --strictPort makes Vite fail fast when
  // E2E_FRONTEND_PORT is already taken rather than silently binding a
  // different port, which would otherwise produce confusing "frontend
  // unreachable" failures instead of a clear port-conflict error.
  // VITE_BACKEND_URL points the frontend's own API client at the backend
  // instance global-setup.ts spawns on E2E_BACKEND_PORT for this same run.
  webServer: {
    command: `npm run dev -- --port ${E2E_FRONTEND_PORT} --strictPort`,
    cwd: FRONTEND_DIR,
    url: FRONTEND_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      VITE_BACKEND_URL: BACKEND_URL,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
