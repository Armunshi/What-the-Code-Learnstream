import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { readSeed } from '../lib/seed-registry.js';

interface CommerceSeed {
  freeCourseId: string;
  freeCourseTitle: string;
  paidCourseId: string;
  paidCourseTitle: string;
}

// displayRazorpay.js's success path, isolated from the real Razorpay
// checkout modal: window.Razorpay is a stub that calls its own `handler`
// synchronously, the real checkout.js script is routed to a harmless stub
// so `loadScript()` still resolves true, and /payment/verify is
// intercepted rather than hit for real — a stubbed razorpay_payment_id
// could never pass verifyPayment's real signature check against the
// Razorpay API (see the "IMPORTANT lesson" this lane was briefed on:
// synthetic payment ids can't be forged there any more). This test is
// deliberately about the frontend's own success-path wiring — invalidate,
// toast, navigate — not a real payment integration.
test.describe('Checkout success path (stubbed Razorpay)', () => {
  test('paying for the cart navigates to the course player', async ({ page, testData }) => {
    const commerce = readSeed<CommerceSeed>('commerce');

    await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '// stubbed for e2e' })
    );
    await page.route('**/payment/verify', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 200, data: {}, message: 'Payment verified', success: true }),
      })
    );
    await page.addInitScript(() => {
      class FakeRazorpay {
        options: { order_id: string; handler: (response: Record<string, string>) => void };
        constructor(options: typeof FakeRazorpay.prototype.options) {
          this.options = options;
        }
        open() {
          Promise.resolve().then(() =>
            this.options.handler({
              razorpay_order_id: this.options.order_id,
              razorpay_payment_id: 'pay_e2e_stub',
              razorpay_signature: 'stub_signature',
            })
          );
        }
        on() {
          // payment.failed listener — never invoked by this stub.
        }
      }
      // @ts-expect-error test-only global stub, not the real Razorpay SDK
      window.Razorpay = FakeRazorpay;
    });

    await loginAs(page, 'student', testData.student);

    await page.goto(`/course/${commerce.paidCourseId}`);
    const addButton = page.getByTestId('purchase-cta-add-to-cart');
    const goToCartButton = page.getByTestId('purchase-cta-go-to-cart');
    // PurchaseCta only renders once CourseDetailPage's own landing-data query
    // resolves — checking isVisible() right after goto() races that and
    // reads a false negative before either button exists yet.
    await page
      .locator('[data-testid="purchase-cta-add-to-cart"], [data-testid="purchase-cta-go-to-cart"]')
      .first()
      .waitFor({ state: 'visible' });
    // Idempotent against a cart this account already had the course in
    // (e.g. from guest-cart.spec.ts's merge-on-login test, run in either
    // order since Playwright doesn't guarantee spec-file ordering here).
    if (await addButton.isVisible()) {
      await addButton.click();
    } else {
      await expect(goToCartButton).toBeVisible();
    }

    await page.goto('/cart');
    await page.getByTestId('cart-checkout').click();

    await page.waitForURL(`**/learn/${commerce.paidCourseId}`);
    await expect(page).toHaveURL(new RegExp(`/learn/${commerce.paidCourseId}$`));
  });
});
