import { test, expect } from '../fixtures/test-data.fixture.js';
import { BACKEND_URL } from '../playwright.config.js';
import {
  getSignupStep1,
  getSignupStep2,
  fillSignupStep1,
  fillOtpCode,
  getResendButton,
} from '../lib/selectors/auth.js';

// Covers the AUTH lane's OTP-signup design (UI_REQS_14_09_26_IMPLEMENTATION_PLAN.md
// "W1-AUTH"): POST /user/:role/signup now returns 202 pending-OTP instead of
// 201, so this spec — unlike every other flow spec — drives signup through
// the real UI instead of api-client.ts's signupStudent/signupTeacher helper.

async function readOtpCode(email: string): Promise<string> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${BACKEND_URL}/__test__/outbox?email=${encodeURIComponent(email)}`);
    const json = await res.json();
    const messages = Array.isArray(json) ? json : json.data ?? [];
    const last = messages[messages.length - 1];
    if (last?.code) return last.code;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No outbox message with a code for ${email} within 5s`);
}

function uniqueEmail(label: string): string {
  return `e2e-signup-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@learnstream.test`;
}

test.describe('Signup / OTP verification', () => {
  test('a student can sign up, verify the OTP, and lands on onboarding', async ({ page }) => {
    const email = uniqueEmail('happy');

    await page.goto('/signup/student');
    await fillSignupStep1(page, { firstName: 'Ada', lastName: 'Lovelace', email, password: 'Passw0rd1' });

    const signupResponse = page.waitForResponse((r) => r.url().includes('/user/student/signup'));
    await getSignupStep1(page).getByRole('button', { name: 'Create account' }).click();
    const response = await signupResponse;
    expect(response.status()).toBe(202);

    await expect(getSignupStep2(page)).toBeVisible();

    const code = await readOtpCode(email);
    const verifyResponse = page.waitForResponse((r) => r.url().includes('/auth/register/verify'));
    await fillOtpCode(page, code);
    await getSignupStep2(page).getByRole('button', { name: 'Verify' }).click();
    const verifyRes = await verifyResponse;
    expect(verifyRes.status()).toBe(201);

    await page.waitForURL(/\/onboarding\/phone/);

    // Onboarding is skippable at every step, never forced.
    await page.getByTestId('skip-phone').click();
    await page.waitForURL(/\/onboarding\/interests/);
    await page.getByTestId('skip-interests').click();
    await page.waitForURL(/\/student\//);
  });

  test('signing up with an already-registered email shows an inline hint', async ({ page, testData }) => {
    await page.goto('/signup/student');
    await fillSignupStep1(page, {
      firstName: 'Dup',
      lastName: 'Licate',
      email: testData.student.email,
      password: 'Passw0rd1',
    });

    await expect(page.getByTestId('email-exists-hint')).toBeVisible({ timeout: 10_000 });
  });

  test('an incorrect OTP code is rejected and the account is not created', async ({ page }) => {
    const email = uniqueEmail('wrongcode');

    await page.goto('/signup/student');
    await fillSignupStep1(page, { firstName: 'Grace', lastName: 'Hopper', email, password: 'Passw0rd1' });
    await getSignupStep1(page).getByRole('button', { name: 'Create account' }).click();
    await expect(getSignupStep2(page)).toBeVisible();

    const verifyResponse = page.waitForResponse((r) => r.url().includes('/auth/register/verify'));
    await fillOtpCode(page, '000000');
    await getSignupStep2(page).getByRole('button', { name: 'Verify' }).click();
    const res = await verifyResponse;
    expect(res.status()).toBe(400);

    // Still on the OTP step — a wrong code never navigates away.
    await expect(getSignupStep2(page)).toBeVisible();
  });

  test('the resend button starts disabled behind the cooldown', async ({ page }) => {
    const email = uniqueEmail('resend');

    await page.goto('/signup/student');
    await fillSignupStep1(page, { firstName: 'Alan', lastName: 'Turing', email, password: 'Passw0rd1' });
    await getSignupStep1(page).getByRole('button', { name: 'Create account' }).click();
    await expect(getSignupStep2(page)).toBeVisible();

    await expect(getResendButton(page)).toBeDisabled();
  });
});
