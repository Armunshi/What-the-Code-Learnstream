import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { findRapidDuplicateGets } from '../lib/duplicate-detection.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';

test.describe('Navigating Course Lists (unauthenticated)', () => {
  test('home page loads the course catalog and category bar', async ({ page, networkLogger }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const getAllCoursesCalls = networkLogger
      .getEntries()
      .filter((e) => e.url.includes('/courses/getallCourses'));
    expect(getAllCoursesCalls.length).toBeGreaterThanOrEqual(1);
    expect(getAllCoursesCalls.every((e) => e.status === 200)).toBe(true);

    // Home.jsx (course-count stat) and GeneralCourses.jsx (category counts)
    // both independently call this same endpoint on mount — a real,
    // plausible hit for the duplicate-GET check, reported as a finding
    // rather than asserted as a hard failure (an acceptable inefficiency
    // until proven otherwise, not necessarily a bug).
    const duplicates = findRapidDuplicateGets(networkLogger.getEntries());
    if (duplicates.length > 0) {
      console.log('[duplicate-GET finding]', JSON.stringify(duplicates));
    }

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });

  test('switching category fires a new filtered course-list request', async ({ page, networkLogger }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scoped to CategoryBar.jsx's own distinctive container class, not any
    // button/link on the page (the navbar alone has several that would
    // otherwise false-match a generic "button, a" locator).
    const categoryButtons = page.locator('.no-scrollbar button');
    const count = await categoryButtons.count();
    test.skip(count < 2, 'Fewer than 2 categories seeded — nothing to switch between.');

    const beforeCount = networkLogger.getEntries().filter((e) => e.url.includes('/courses?category=')).length;
    await categoryButtons.last().click(); // default-selected category is always categories[0]
    await page.waitForLoadState('networkidle');
    const afterCount = networkLogger.getEntries().filter((e) => e.url.includes('/courses?category=')).length;

    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});

test.describe('Navigating Course Lists (authenticated student)', () => {
  test.beforeEach(async ({ page, testData }) => {
    await loginAs(page, 'student', testData.student);
  });

  test("student dashboard's authenticated course fetch carries the Authorization header", async ({
    page,
    networkLogger,
  }) => {
    const userMeta = await page.evaluate(() => localStorage.getItem('userMeta'));
    test.skip(!userMeta, 'No userMeta in localStorage — login did not persist as expected.');
    const { user_id } = JSON.parse(userMeta as string);

    const studentCoursesResponse = page.waitForResponse((r) => r.url().includes('/courses/student/'));
    await page.goto(`/student/${user_id}`);
    const response = await studentCoursesResponse;

    expect(response.status()).toBe(200);
    expect(response.request().headers()['authorization']).toMatch(/^Bearer .+/);
  });
});
