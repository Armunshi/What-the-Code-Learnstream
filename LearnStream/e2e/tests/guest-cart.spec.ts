import { test, expect } from '../fixtures/test-data.fixture.js';
import { BACKEND_URL } from '../playwright.config.js';
import { loginAs } from '../lib/selectors.js';
import { readSeed } from '../lib/seed-registry.js';

interface CommerceSeed {
  freeCourseId: string;
  freeCourseTitle: string;
  paidCourseId: string;
  paidCourseTitle: string;
}

// The guest cart (guestCartStore.js) is a localStorage-backed zustand store
// with no server involvement at all until a merge-on-login happens
// (CartProvider.jsx) — these three tests exercise persistence, cross-tab
// sync, and the merge/logout boundary, in that order.
test.describe('Guest cart (localStorage, cross-tab, merge-on-login)', () => {
  test('a guest can add a paid course to the cart and it survives a reload', async ({ page }) => {
    const commerce = readSeed<CommerceSeed>('commerce');

    await page.goto(`/course/${commerce.paidCourseId}`);
    await page.getByTestId('purchase-cta-add-to-cart').click();

    await page.goto('/cart');
    await expect(page.getByTestId('cart-item')).toContainText(commerce.paidCourseTitle);

    await page.reload();
    await expect(page.getByTestId('cart-item')).toContainText(commerce.paidCourseTitle);
  });

  test('a second tab sees the same guest cart update live via the storage event', async ({ page, context }) => {
    const commerce = readSeed<CommerceSeed>('commerce');
    const pageB = await context.newPage();

    try {
      await page.goto('/cart');
      await expect(page.getByTestId('cart-empty')).toBeVisible();

      await pageB.goto(`/course/${commerce.paidCourseId}`);
      const addButtonB = pageB.getByTestId('purchase-cta-add-to-cart');
      const goToCartButtonB = pageB.getByTestId('purchase-cta-go-to-cart');
      // PurchaseCta only settles into one of these two once its own meSummary
      // query resolves — checking isVisible() immediately after goto() races
      // that resolution and reads a false negative before either has mounted.
      await pageB
        .locator('[data-testid="purchase-cta-add-to-cart"], [data-testid="purchase-cta-go-to-cart"]')
        .first()
        .waitFor({ state: 'visible' });
      if (await addButtonB.isVisible()) {
        await addButtonB.click();
      } else {
        await expect(goToCartButtonB).toBeVisible();
      }

      // guestCartStore.js's `window.addEventListener('storage', ...)` only
      // fires on the *other* document than the one that wrote — page A
      // never reloads, so this is a live re-render off that listener, not a
      // stale snapshot re-read on navigation.
      await expect(page.getByTestId('cart-item')).toContainText(commerce.paidCourseTitle);
    } finally {
      await pageB.close();
    }
  });

  test('merges the guest cart on login, and a subsequent logout does not bring it back', async ({
    page,
    testData,
  }) => {
    const commerce = readSeed<CommerceSeed>('commerce');

    await page.goto(`/course/${commerce.paidCourseId}`);
    const addButton = page.getByTestId('purchase-cta-add-to-cart');
    const goToCartButton = page.getByTestId('purchase-cta-go-to-cart');
    await page
      .locator('[data-testid="purchase-cta-add-to-cart"], [data-testid="purchase-cta-go-to-cart"]')
      .first()
      .waitFor({ state: 'visible' });
    if (await addButton.isVisible()) {
      await addButton.click();
    } else {
      await expect(goToCartButton).toBeVisible();
    }

    // Same page/tab, same localStorage — loginAs navigates to /login and
    // back, it never clears the guest cart itself. CartProvider's
    // merge-on-login effect is what's under test here.
    await loginAs(page, 'student', testData.student);

    await page.goto('/cart');
    await expect(page.getByTestId('cart-item')).toContainText(commerce.paidCourseTitle);
    // mode: 'server' once merged — the checkout button appears instead of
    // the guest's "log in to check out" link.
    await expect(page.getByTestId('cart-checkout')).toBeVisible();

    // No logout UI exists yet (NAV's UserMenu hasn't landed) — drive the
    // real backend endpoint directly. page.request shares this page's
    // cookie jar, so the httpOnly refresh cookie logout needs is already
    // there.
    const logoutRes = await page.request.post(`${BACKEND_URL}/user/student/logout`);
    expect(logoutRes.status()).toBe(200);

    await page.reload();
    // Logged out -> mode: 'guest' again, reading a guest cart that was
    // cleared by the successful merge above, not the merged item resurfacing.
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });
});
