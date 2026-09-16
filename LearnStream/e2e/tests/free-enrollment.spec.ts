import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { readSeed } from '../lib/seed-registry.js';

interface CommerceSeed {
  freeCourseId: string;
  freeCourseTitle: string;
  paidCourseId: string;
  paidCourseTitle: string;
}

// D10: a free (price === 0) PUBLISHED course enrolls directly through
// POST /courses/:courseId/enroll — it never touches /payment/create-order,
// unlike a paid course's cart/checkout flow (checkout-redirect.spec.ts).
test.describe('Free course enrollment (D10)', () => {
  test('an authenticated student enrolls with zero /payment/* requests and lands on the player', async ({
    page,
    networkLogger,
    testData,
  }) => {
    const commerce = readSeed<CommerceSeed>('commerce');
    await loginAs(page, 'student', testData.student);

    await page.goto(`/course/${commerce.freeCourseId}`);
    await page.getByTestId('purchase-cta-enroll').click();

    await page.waitForURL(`**/learn/${commerce.freeCourseId}`);
    await expect(page).toHaveURL(new RegExp(`/learn/${commerce.freeCourseId}$`));

    const paymentCalls = networkLogger.getEntries().filter((e) => e.url.includes('/payment/'));
    expect(paymentCalls).toEqual([]);
  });

  test('enrolling is idempotent — revisiting the course shows "Go to course" directly', async ({
    page,
    testData,
  }) => {
    const commerce = readSeed<CommerceSeed>('commerce');
    await loginAs(page, 'student', testData.student);

    await page.goto(`/course/${commerce.freeCourseId}`);
    await expect(page.getByTestId('purchase-cta-enrolled')).toBeVisible();
  });
});
