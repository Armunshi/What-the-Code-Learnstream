import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { categoryTab, categoryTabs, courseCards, courseGrid } from '../lib/selectors.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';
import { readSeed } from '../lib/seed-registry.js';

interface CatalogSeed {
  courseId: string;
  courseTitle: string;
  category: string;
  secondCourseId: string;
  secondCategory: string;
}

// Rewritten for W1-CAT's new HomePage (CategoryTabs + CourseGrid over
// GET /courses/catalog), replacing the retired GeneralCourses/CategoryBar
// assertions against `.no-scrollbar button` and `/courses/getallCourses` —
// both gone now that Home.jsx renders features/catalog/pages/HomePage.jsx
// instead (see that file's own comment on the /courses/getallCourses ->
// /courses/catalog switch).
test.describe('Navigating Course Lists (unauthenticated)', () => {
  test('home page loads the catalog via /courses/catalog and renders the category tabs', async ({ page, networkLogger }) => {
    const catalog = readSeed<CatalogSeed>('catalog');

    const catalogResponse = page.waitForResponse((r) => r.url().includes('/courses/catalog'));
    await page.goto('/');
    await catalogResponse;
    await page.waitForLoadState('networkidle');

    const catalogCalls = networkLogger.getEntries().filter((e) => e.url.includes('/courses/catalog'));
    expect(catalogCalls.length).toBeGreaterThanOrEqual(1);
    expect(catalogCalls.every((e) => e.status === 200)).toBe(true);

    await expect(categoryTabs(page)).toBeVisible();
    await expect(courseGrid(page)).toBeVisible();

    // Both PUBLISHED courses the catalog seed produced are visible under
    // "All" (the default, unfiltered view) — a draft never should be
    // (D2's visibility rule), which the base fixture's own two courses
    // (left DRAFT on purpose) implicitly cover: they must NOT appear here.
    await expect(page.getByTestId('course-card').filter({ hasText: catalog.courseTitle })).toBeVisible();

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });

  test('switching category tabs re-fetches the catalog filtered to that category', async ({ page, networkLogger }) => {
    const catalog = readSeed<CatalogSeed>('catalog');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const beforeCount = networkLogger.getEntries().filter((e) => e.url.includes('/courses/catalog')).length;

    const filteredResponse = page.waitForResponse(
      (r) => r.url().includes('/courses/catalog') && r.url().includes(`category=${catalog.secondCategory}`)
    );
    await categoryTab(page, 'Business').click();
    const response = await filteredResponse;
    expect(response.status()).toBe(200);

    const afterCount = networkLogger.getEntries().filter((e) => e.url.includes('/courses/catalog')).length;
    expect(afterCount).toBeGreaterThan(beforeCount);

    // The "development"-category course drops out of the grid once filtered
    // to "business", and the "business"-category one it switched to shows.
    await expect(courseCards(page).filter({ hasText: catalog.courseTitle })).toHaveCount(0);

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
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
