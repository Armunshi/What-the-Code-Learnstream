import { defineConfig, devices } from '@playwright/test';

export const FRONTEND_URL = 'http://localhost:2000';
export const BACKEND_URL = 'http://localhost:8000';

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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
