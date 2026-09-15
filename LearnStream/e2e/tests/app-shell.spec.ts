import { test, expect } from '../fixtures/test-data.fixture.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';

// Covers the two W0-A app-shell contracts that don't belong to any single
// feature flow: AuthProvider must never block the page behind a "Loading..."
// screen while it resolves (docs/contracts + plan §2.2 — status is now
// 'unknown' | 'authenticated' | 'guest', not a boolean), and publicClient
// must never attach an Authorization header (H-FR-3.2) — a guest-facing
// call carrying a stale/garbage header would be a real regression even
// though it might still "work" by accident.

test.describe('App shell', () => {
  test('the page renders before the auth refresh resolves, not behind a blocking loading screen', async ({
    page,
  }) => {
    // Holds the refresh-token response open indefinitely until the test
    // explicitly releases it, so anything that already rendered by the time
    // we assert did so genuinely independently of that request settling —
    // the exact scenario the old `if (loading) return <div>Loading...</div>`
    // used to prevent.
    let releaseRefresh: () => void = () => {};
    const refreshHeld = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    await page.route('**/auth/refresh-Token', async (route) => {
      await refreshHeld;
      await route.continue();
    });

    await page.goto('/');

    // Real page content (the nav brand, rendered by the still-mounted
    // legacy Navbar1) is visible while the refresh call above is
    // deliberately stuck pending — proof the tree rendered without waiting
    // on it.
    await expect(page.getByText('LearnStream').first()).toBeVisible();
    await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);

    releaseRefresh();
    await page.waitForLoadState('networkidle');
  });

  test('a public catalog call never carries an Authorization header', async ({ page, networkLogger }) => {
    // Was /courses/getallCourses (the legacy homepage) — CAT's real
    // HomePage (Wave 1) calls the new GET /courses/catalog instead. The
    // property under test (a guest-facing homepage call never attaches
    // Authorization) is unchanged; only the endpoint it goes through is.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const publicCalls = networkLogger
      .getEntries()
      .filter((entry) => entry.url.includes('/courses/catalog'));
    expect(publicCalls.length).toBeGreaterThanOrEqual(1);

    // The network logger doesn't capture request headers itself, so this
    // intercepts a fresh request the same way and reads its headers
    // directly — reloading is cheap and keeps the assertion exact instead
    // of guessing from the logger's summary shape.
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/courses/catalog')),
      page.reload(),
    ]);
    const headers = request.headers();
    expect(headers.authorization).toBeUndefined();

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });
});
