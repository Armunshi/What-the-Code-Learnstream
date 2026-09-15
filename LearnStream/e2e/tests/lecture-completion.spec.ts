import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { findDuplicatePosts } from '../lib/duplicate-detection.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';

test.beforeEach(async ({ page, testData }) => {
  await loginAs(page, 'student', testData.student);
});
// Not parallelized (playwright.config.ts: workers: 1) — these tests rely on
// running in file order against the same two seeded lectures.

test.describe('Marking a Lecture Complete', () => {
  test('one real user click marks the lecture complete with exactly one POST', async ({
    page,
    networkLogger,
    testData,
  }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'E2E Module 1' }).click();
    await page.getByRole('button', { name: 'E2E Lecture 1' }).click();
    await page.waitForURL(/\/view$/);

    const checkbox = page.locator('label', { hasText: 'E2E Lecture 1' }).locator('input[type=checkbox]');
    await expect(checkbox).not.toBeChecked();

    const completeResponse = page.waitForResponse((r) =>
      r.url().includes(`/lectures/${testData.lectureId}/complete`)
    );
    await page.getByText('E2E Lecture 1').click();
    const response = await completeResponse;

    expect(response.status()).toBe(200);
    await expect(checkbox).toBeChecked();

    // LectureAssig.jsx's checkbox <input> is nested inside a <label>, which
    // is itself inside the clickable Card — clicking anywhere in a <label>
    // that wraps a form control makes the browser forward a second,
    // synthetic click to that control, and that forwarded click also
    // bubbles up to the Card's onClick. Fixed by stopping propagation on
    // the input's own onClick, so only the original click (on the label or
    // its text) reaches the Card and fires handleSelectLecture — exactly
    // one POST per physical click.
    const completeCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes(`/lectures/${testData.lectureId}/complete`));
    expect(completeCalls).toHaveLength(1);

    const completedGetCalls = networkLogger.getEntries().filter((e) => e.url.includes('/completed'));
    expect(completedGetCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('reload after completion does not re-POST — status persists from the completed-list GET alone', async ({
    page,
    networkLogger,
    testData,
  }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'E2E Module 1' }).click();
    await page.getByRole('button', { name: 'E2E Lecture 1' }).click();
    await page.waitForURL(/\/view$/);

    // Completed by the previous test in this file (file-ordered, workers: 1).
    const checkbox = page.locator('label', { hasText: 'E2E Lecture 1' }).locator('input[type=checkbox]');
    await expect(checkbox).toBeChecked();

    const completeCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes(`/lectures/${testData.lectureId}/complete`));
    expect(completeCalls).toHaveLength(0);
  });

  test('rapid double-click does not compound into extra POSTs', async ({
    page,
    networkLogger,
    testData,
  }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'E2E Module 1' }).click();
    // A second, still-incomplete lecture — Lecture 1 is already done by now.
    await page.getByRole('button', { name: 'E2E Lecture 2' }).click();
    await page.waitForURL(/\/view$/);

    const lectureTarget = page.getByText('E2E Lecture 2');
    await Promise.all([lectureTarget.click(), lectureTarget.click()]); // no await gap — two physical clicks
    await page.waitForTimeout(1000); // let any in-flight requests resolve before reading the log

    const completeCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes(`/lectures/${testData.lecture2Id}/complete`));

    // Two physical clicks, each now single-dispatching (the label/checkbox
    // fix above), still race two calls to handleSelectLecture against the
    // same async completion POST. The synchronous pendingCompletionsRef
    // guard — set before the first `await`, so the second call sees it
    // immediately rather than reading a stale "not completed yet" state
    // snapshot — collapses that down to exactly one POST.
    expect(completeCalls).toHaveLength(1);

    const duplicates = findDuplicatePosts(networkLogger.getEntries(), /\/complete$/);
    expect(duplicates).toEqual([]);
  });

  test('no unexpected console errors across the flow', async ({ page, networkLogger, testData }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'E2E Module 1' }).click();
    await page.getByRole('button', { name: 'E2E Lecture 1' }).click();
    await page.waitForURL(/\/view$/);
    await page.waitForLoadState('networkidle');

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });
});
