import type { Page, Locator } from '@playwright/test';

// login.jsx renders two structurally identical <form> elements side by
// side, each a sibling of a heading-only div (not a descendant of it) —
// both inside a shared container. `div:has(heading)` matches every
// ancestor at any depth, so `.first()` on that resolves to the outermost
// page wrapper, not the form's own container. XPath's ancestor axis, taken
// nearest-first, is the correct tool: the closest ancestor div that also
// contains a <form> descendant is exactly the per-role section.
export function getLoginForm(page: Page, role: 'student' | 'teacher'): Locator {
  const heading = role === 'teacher' ? 'Teacher Login' : 'Student Login';
  return page.getByRole('heading', { name: heading }).locator('xpath=ancestor::div[.//form][1]');
}

/**
 * Logs in fresh via the real UI. Deliberately NOT using a reused
 * storageState snapshot: AuthProvider.jsx refreshes the access token on
 * every mount, and auth.routes.js's refreshAccessToken rotates the stored
 * refresh token on every successful call — so a static, pre-captured
 * cookie only works for the first browser context that ever uses it. Every
 * subsequent fresh context loaded from the same snapshot presents a
 * now-stale token and fails. A real per-test login avoids that entirely.
 */
export async function loginAs(
  page: Page,
  role: 'student' | 'teacher',
  creds: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  const form = getLoginForm(page, role);
  await form.getByPlaceholder('Email').fill(creds.email);
  await form.getByPlaceholder('Password').fill(creds.password);
  await form.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(new RegExp(`/${role}/`), { timeout: 15_000 });
}
