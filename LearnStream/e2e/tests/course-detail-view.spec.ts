import { test, expect } from '../fixtures/test-data.fixture.js';
import { curriculumItems, previewItemButtons } from '../lib/selectors.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';
import { readSeed } from '../lib/seed-registry.js';

interface CatalogSeed {
  courseId: string;
  courseTitle: string;
  category: string;
  freeLectureId: string;
}

// Rewritten for W1-CAT: the marketing/landing course page moved from
// /user/:courseId (ViewStudentModule.jsx, enrolled-student lecture view) to
// /course/:courseId (CourseDetailPage.jsx, public landing page — actual
// lecture-watching is LEARN's /learn/:courseId, not built yet). See
// Pages/ViewStudentModule.jsx's own comment for why this split is correct
// rather than a regression.
test.describe('Viewing the public course page (guest)', () => {
  test('loads the full landing page — hero, trailer, curriculum — with no auth', async ({ page, networkLogger }) => {
    const catalog = readSeed<CatalogSeed>('catalog');

    const landingResponse = page.waitForResponse((r) => r.url().includes(`/courses/${catalog.courseId}/landing`));
    const curriculumResponse = page.waitForResponse((r) => r.url().includes(`/courses/${catalog.courseId}/curriculum`));
    await page.goto(`/course/${catalog.courseId}`);
    const [landing, curriculum] = await Promise.all([landingResponse, curriculumResponse]);

    expect(landing.status()).toBe(200);
    expect(curriculum.status()).toBe(200);
    // optionalAuth routes: a guest request never carries a token to attach.
    expect(landing.request().headers()['authorization']).toBeUndefined();

    await expect(page.getByRole('heading', { name: catalog.courseTitle })).toBeVisible();
    await expect(page.getByTestId('course-trailer-trigger')).toBeVisible();

    await page.waitForLoadState('networkidle');
    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });

  test('curriculum shows a free-preview item with a Preview control and a locked item with none', async ({ page }) => {
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);
    await page.waitForLoadState('networkidle');

    await expect(curriculumItems(page)).toHaveCount(2);
    await expect(previewItemButtons(page)).toHaveCount(1);

    const lockedItem = curriculumItems(page).filter({ hasText: 'Locked lecture' });
    await expect(lockedItem.getByTestId('preview-item-button')).toHaveCount(0);
    await expect(lockedItem.getByLabel('Locked')).toBeVisible();
  });

  test('a guest can play the free-preview lecture', async ({ page }) => {
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);
    await page.waitForLoadState('networkidle');

    const playbackResponse = page.waitForResponse((r) =>
      r.url().includes(`/courses/${catalog.courseId}/items/${catalog.freeLectureId}/playback`)
    );
    await previewItemButtons(page).click();
    const response = await playbackResponse;
    expect(response.status()).toBe(200);

    const dialog = page.getByTestId('free-preview-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('video')).toBeVisible();
  });

  test('a guest can open the trailer from the sticky preview card', async ({ page }) => {
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('course-trailer-trigger').click();
    await expect(page.locator('video')).toBeVisible();
  });

  test('the legacy /user/:courseId route redirects to /course/:courseId', async ({ page }) => {
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/user/${catalog.courseId}`);
    await page.waitForURL(`**/course/${catalog.courseId}`);
    await expect(page).toHaveURL(new RegExp(`/course/${catalog.courseId}$`));
  });
});
