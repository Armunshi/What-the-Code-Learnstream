import { test, expect } from '../fixtures/test-data.fixture.js';
import { loginAs } from '../lib/selectors.js';
import { readSeed } from '../lib/seed-registry.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';

interface AccountSeed {
  username: string;
  studentEmail: string;
}

// Required by this lane's definition of done: edit headline -> the public
// profile shows it. Exercises the full round trip — PATCH /users/me/profile
// through the real Account > Profile form, then GET /users/:username through
// the real PublicProfilePage — rather than asserting against either
// endpoint's response body directly.
test.describe('Account profile -> public profile', () => {
  test('editing the headline in Account settings shows it on the public profile', async ({
    page,
    testData,
    networkLogger,
  }) => {
    const accountSeed = readSeed<AccountSeed>('account');
    await loginAs(page, 'student', testData.student);

    const headline = `Full-stack learner ${Date.now()}`;

    await page.goto('/account/profile');
    await page.getByTestId('headline-input').fill(headline);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile updated')).toBeVisible();

    await page.goto(`/user/${accountSeed.username}`);
    await expect(page.getByTestId('public-profile-headline')).toHaveText(headline);

    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });
});
