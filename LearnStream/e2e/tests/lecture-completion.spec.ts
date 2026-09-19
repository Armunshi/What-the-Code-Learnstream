import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { readSeed } from '../lib/seed-registry.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';

interface LearnSeed {
  videoItemId: string;
  articleItemId: string;
}

// This used to drive the legacy /user/:courseId -> module list -> lecture
// player flow, clicking a checkbox to mark a lecture complete. That flow no
// longer exists: ViewStudentModule.jsx (the module list) now redirects to
// /course/:courseId per the plan's D8 routing table, and the real player at
// /learn/:courseId/items/:itemId never accepts a manual complete for video
// at all (D5) — it auto-completes from a watch-position heartbeat at 90%
// watched. This spec now tests that mechanism directly, against the video
// item e2e/seeds/learn.seed.ts creates (a real, decodable, exactly-4-second
// clip, embedded as a data: URI so it genuinely plays in a browser here).
//
// Not parallelized (playwright.config.ts: workers: 1) — the two tests below
// share the same seeded video item and its accumulated watchedSec, in file
// order, deliberately: the "seeking" test's near-zero credited delta and
// the "watching" test's full credited delta both add into the same
// WatchPosition document, and the arithmetic is designed to hold under
// that (see comments below), rather than needing a second seeded video.

test.beforeEach(async ({ page, testData }) => {
  await loginAs(page, 'student', testData.student);
});

async function gotoVideoItem(page: Page, courseId: string, itemId: string) {
  await page.goto(`/learn/${courseId}/items/${itemId}`);
  // LearnLayout's access-touch (GET /learn/:courseId/items/:itemId) is what
  // resets the server's heartbeat baseline (lastHeartbeatAt = now) for this
  // item — waiting for the video element to exist is a reliable proxy for
  // that request having already completed, since the player only renders
  // once the tree query (which runs after the same mount effect) resolves.
  await page.locator('video').waitFor();
}

test.describe('Video watch-position completion (D5)', () => {
  test('seeking to the end without watching does not complete the item', async ({
    page,
    networkLogger,
    testData,
  }) => {
    const learnSeed = readSeed<LearnSeed>('learn');
    await gotoVideoItem(page, testData.courseId, learnSeed.videoItemId);

    // A seek changes currentTime instantly with no real playback time
    // elapsed, so the very next heartbeat's watchedDeltaSec claim (~4s) gets
    // capped server-side to ~0 (elapsedWallClockSec since the access-touch
    // above, which just happened). Dispatching `pause` is what triggers a
    // heartbeat send outside the normal 15s interval.
    const video = page.locator('video');
    await video.evaluate((el) => {
      const v = el as unknown as { currentTime: number; duration: number };
      v.currentTime = v.duration || 4;
    });
    const positionResponse = page.waitForResponse((r) =>
      r.url().includes(`/learn/${testData.courseId}/items/${learnSeed.videoItemId}/position`)
    );
    await video.dispatchEvent('pause');
    const response = await positionResponse;

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.completed).toBe(false);

    await expect(page.getByTestId('item-completed-badge')).toHaveCount(0);

    const positionCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes(`/items/${learnSeed.videoItemId}/position`));
    expect(positionCalls).toHaveLength(1);
  });

  test('watching the video to the end marks it complete with exactly one heartbeat call', async ({
    page,
    networkLogger,
    testData,
  }) => {
    const learnSeed = readSeed<LearnSeed>('learn');
    await gotoVideoItem(page, testData.courseId, learnSeed.videoItemId);

    // Navigating fresh re-runs the access-touch and resets the server's
    // heartbeat baseline again — so the previous test's near-zero credited
    // delta doesn't count against this test's elapsed-time budget. Muting
    // is required for Chromium to allow programmatic playback without a
    // prior user gesture.
    const completeResponse = page.waitForResponse(
      (r) =>
        r.url().includes(`/learn/${testData.courseId}/items/${learnSeed.videoItemId}/position`) &&
        r.request().method() === 'PUT'
    );
    const video = page.locator('video');
    await video.evaluate(async (el) => {
      const v = el as unknown as { muted: boolean; play: () => Promise<void> };
      v.muted = true;
      await v.play();
    });
    const response = await completeResponse;

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.completed).toBe(true);

    await expect(page.getByTestId('item-completed-badge')).toBeVisible();

    // The 4-second clip ends on its own — only the `ended` handler's
    // sendNow() should have fired a heartbeat (the 15s interval never gets
    // a chance to, and playing straight through never pauses).
    const positionCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes(`/items/${learnSeed.videoItemId}/position`));
    expect(positionCalls).toHaveLength(1);
  });

  test('reload after completion sends no further heartbeats', async ({ page, networkLogger, testData }) => {
    const learnSeed = readSeed<LearnSeed>('learn');
    await gotoVideoItem(page, testData.courseId, learnSeed.videoItemId);

    // Completed by the previous test in this file (file-ordered, workers: 1).
    await expect(page.getByTestId('item-completed-badge')).toBeVisible();

    // useWatchHeartbeat is only ever enabled when `!completed` — an already-
    // complete item should never send a position heartbeat at all, reload
    // or not.
    await page.waitForTimeout(500);
    const positionCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes(`/items/${learnSeed.videoItemId}/position`));
    expect(positionCalls).toHaveLength(0);
  });

  test('no unexpected console errors across the flow', async ({ page, networkLogger, testData }) => {
    const learnSeed = readSeed<LearnSeed>('learn');
    await gotoVideoItem(page, testData.courseId, learnSeed.videoItemId);
    await page.waitForLoadState('networkidle');

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });
});
