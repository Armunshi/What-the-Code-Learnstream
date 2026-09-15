import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../fixtures/assets');
const PROMO_VIDEO = path.join(ASSETS_DIR, 'placeholder-lecture.mp4');

// D4's own required harness coverage (docs/lanes/upl.json's `appends` —
// amended to list this file, since the manifest's original `appends` was
// empty despite D4 explicitly calling for harness e2e tests; see that
// file's `notes`). Runs against MEDIA_PROVIDER=fake, always on for e2e
// (global-setup.ts), against /__e2e__/upload-harness — a page that exists
// only when VITE_E2E_HARNESS=1 is set for this run (see
// frontend/src/features/uploads/routes.jsx and this repo's README for how
// to set it locally).
test.describe('Upload pipeline harness (fake provider)', () => {
  test('progress -> processing -> ready survives a reload', async ({ page, testData }) => {
    await loginAs(page, 'teacher', testData.teacher);
    await page.goto(`/__e2e__/upload-harness?courseId=${testData.courseId}`);

    const promoField = page.getByTestId('promo-video-section').getByTestId('media-upload-field');
    await expect(promoField).toHaveAttribute('data-status', 'idle');

    await promoField.getByTestId('media-upload-input').setInputFiles(PROMO_VIDEO);

    // The fake provider's own transcode delay is short (fakeStore.js), so
    // this may already be READY by the time the assertion below runs — the
    // point of this test is that either way, the state survives a reload,
    // not that we win a race against a 400ms timer.
    await expect(promoField).toHaveAttribute('data-status', /processing|ready/, { timeout: 15_000 });

    await page.reload();

    const promoFieldAfterReload = page.getByTestId('promo-video-section').getByTestId('media-upload-field');
    await expect(promoFieldAfterReload).toHaveAttribute('data-status', 'ready', { timeout: 15_000 });
    await expect(promoFieldAfterReload.getByTestId('media-upload-ready')).toBeVisible();
  });

  test('a forced chunk failure lands the field in Failed, and Retry succeeds once the failure is lifted', async ({
    page,
    testData,
  }) => {
    await loginAs(page, 'teacher', testData.teacher);
    await page.goto(`/__e2e__/upload-harness?courseId=${testData.courseId}`);

    const promoField = page.getByTestId('promo-video-section').getByTestId('media-upload-field');
    await expect(promoField).toHaveAttribute('data-status', 'idle');

    await page.getByTestId('force-failure-toggle').locator('input').check();
    await promoField.getByTestId('media-upload-input').setInputFiles(PROMO_VIDEO);

    // 3 retries with backoff (config/uploadPolicy.js's CHUNK_MAX_RETRIES /
    // CHUNK_RETRY_BASE_DELAY_MS) before the field gives up and shows Failed.
    await expect(promoField).toHaveAttribute('data-status', 'failed', { timeout: 15_000 });
    await expect(promoField.getByTestId('media-upload-failed')).toBeVisible();

    await page.getByTestId('force-failure-toggle').locator('input').uncheck();
    await promoField.getByTestId('media-upload-retry').click();

    await expect(promoField).toHaveAttribute('data-status', /processing|ready/, { timeout: 15_000 });
  });
});
