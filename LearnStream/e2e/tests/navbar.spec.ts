import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors/auth.js';
import { readSeed } from '../lib/seed-registry.js';

interface CatalogSeed {
  courseId: string;
  courseTitle: string;
  category: string;
  freeLectureId: string;
}

// SiteHeader only mounts on routes under RootLayout (app/router.jsx) — "/"
// itself is still the legacy Layout.jsx + Navbar1 today (features/catalog/
// routes.jsx's own comment explains why), so every test here uses a route
// that's actually live under the new shell. /course/:courseId is public
// (no auth required either way), which keeps the guest-focused assertions
// simple.
test.describe('SiteHeader (NAV)', () => {
  test('a guest sees Log in / Sign up, not the account menu', async ({ page }) => {
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);

    await expect(page.getByTestId('nav-login-link')).toBeVisible();
    await expect(page.getByTestId('nav-signup-link')).toBeVisible();
    await expect(page.getByTestId('user-menu-trigger')).toHaveCount(0);
  });

  test('Explore opens and navigates via the keyboard alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);

    const trigger = page.getByRole('button', { name: 'Explore' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const panel = page.getByTestId('explore-menu-panel');
    await expect(panel).toBeVisible();

    // Development is always the first category (backend/src/config/
    // taxonomy.js), so its first subcategory link ("Web Development") is
    // reachable by tabbing straight in from the trigger without depending
    // on seeded data.
    const firstCategory = page.getByTestId('explore-category').first();
    await expect(firstCategory).toHaveText('Development');
    await firstCategory.focus();

    const firstSubcategory = page.getByTestId('explore-subcategory').first();
    await expect(firstSubcategory).toHaveText('Web Development');
    await firstSubcategory.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/\?category=development&sub=web-development/);
  });

  test('below md: only the logo, search icon, cart and hamburger show directly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);

    await expect(page.getByTestId('mobile-nav-trigger')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explore' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Teach on LearnStream' })).toBeHidden();
  });

  test('md-lg: the hamburger still holds Explore and Teach', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);

    await expect(page.getByTestId('mobile-nav-trigger')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explore' })).toBeHidden();

    await page.getByTestId('mobile-nav-trigger').click();
    await expect(page.getByTestId('mobile-explore-category').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Teach on LearnStream' })).toBeVisible();
  });

  test('lg and up: Explore and Teach render directly, the hamburger hides', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const catalog = readSeed<CatalogSeed>('catalog');
    await page.goto(`/course/${catalog.courseId}`);

    await expect(page.getByTestId('mobile-nav-trigger')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Teach on LearnStream' })).toBeVisible();
  });

  test('a teacher sees no cart in the header', async ({ page, testData }) => {
    const catalog = readSeed<CatalogSeed>('catalog');
    await loginAs(page, 'teacher', testData.teacher);
    await page.goto(`/course/${catalog.courseId}`);

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Instructor dashboard' })).toBeVisible();
  });
});
