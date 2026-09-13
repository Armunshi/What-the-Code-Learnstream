import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';

test.beforeEach(async ({ page, testData }) => {
  await loginAs(page, 'student', testData.student);
});

test.describe('Viewing Course Details (enrolled student)', () => {
  test('all four on-mount data calls succeed', async ({ page, networkLogger, testData }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');

    const entries = networkLogger.getEntries();
    const mustSucceed = [
      `/courses/${testData.courseId}/modules`,
      `/courses/${testData.courseId}/`,
      `/courses/${testData.courseId}/progress`,
      `/courses/${testData.courseId}/enrolled`,
    ];

    for (const path of mustSucceed) {
      const calls = entries.filter((e) => e.url.includes(path));
      expect(calls.length, `expected at least one call to ${path}`).toBeGreaterThanOrEqual(1);
      expect(
        calls.every((e) => e.status === 200),
        `expected every call to ${path} to return 200, got ${calls.map((c) => c.status).join(', ')}`
      ).toBe(true);
    }

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });

  test('shows "Already Enrolled" — proves the forged-signature fixture enrollment actually took effect server-side', async ({
    page,
    testData,
  }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');

    const buyButton = page.getByRole('button', { name: 'Already Enrolled' });
    await expect(buyButton).toBeVisible();
    await expect(buyButton).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Buy Now' })).not.toBeVisible();
  });

  test('expanding/collapsing a module toggles locally with no additional network call', async ({
    page,
    networkLogger,
    testData,
  }) => {
    await page.goto(`/user/${testData.courseId}`);
    await page.waitForLoadState('networkidle');

    const moduleHeader = page.getByRole('button', { name: 'E2E Module 1' });
    await expect(moduleHeader).toBeVisible();

    const countBefore = networkLogger.getEntries().length;
    await moduleHeader.click(); // expand
    await expect(page.getByText('E2E Lecture 1')).toBeVisible();
    await moduleHeader.click(); // collapse
    await page.waitForTimeout(300); // let any accidental async call surface
    const countAfter = networkLogger.getEntries().length;

    expect(countAfter).toBe(countBefore);
  });
});
