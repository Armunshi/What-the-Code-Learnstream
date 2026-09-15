import { test, expect } from '../fixtures/test-data.fixture.js';
import { getLoginForm } from '../lib/selectors/auth.js';
import type { Page } from '@playwright/test';

// Covers plan W1-SHELL's e2e scenario: create a draft -> edit objectives ->
// "Saved" -> reload persists -> two-tab conflict dialog -> leaving during a
// save prompts.
//
// Logs in via the real UI (not the API) like every other spec in this
// suite, but does NOT use lib/selectors.ts's shared `loginAs` — that helper
// asserts the URL matches `/teacher/` right after login, and this lane's
// TeachersPage now client-side-redirects away from `/teacher/:id` to
// `/instructor/courses` immediately on render. Whether that intermediate
// URL is observably distinct from the final one is a timing question this
// spec shouldn't gamble the shared helper on, so it waits for the one URL
// it actually needs instead.
async function loginTeacherOnInstructorCourses(page: Page, creds: { email: string; password: string }) {
  await page.goto('/login');
  const form = getLoginForm(page, 'teacher');
  await form.getByPlaceholder('Email').fill(creds.email);
  await form.getByPlaceholder('Password').fill(creds.password);
  await form.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/instructor/courses', { timeout: 15_000 });
}

async function createDraftCourse(page: Page, title: string): Promise<string> {
  await page.getByRole('button', { name: 'Create a course' }).first().click();
  await page.waitForURL('**/instructor/courses/new');
  await page.getByLabel('Course title').fill(title);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/instructor\/courses\/[a-f0-9]+\/plan\/learners$/);
  const match = page.url().match(/\/instructor\/courses\/([a-f0-9]+)\//);
  if (!match) throw new Error(`could not extract courseId from ${page.url()}`);
  return match[1];
}

test.describe('Authoring shell', () => {
  test('create a draft, edit objectives, autosave, and persist across reload', async ({ page, testData }) => {
    await loginTeacherOnInstructorCourses(page, testData.teacher);

    const title = `Authoring Shell Course ${Date.now()}`;
    await createDraftCourse(page, title);

    await page.getByRole('button', { name: '+ Add objective' }).click();
    await page.getByLabel('Learning objective 1').fill('Build a REST API');

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByLabel('Learning objective 1')).toHaveValue('Build a REST API', { timeout: 15_000 });
  });

  test('a stale editVersion in a second tab opens the conflict dialog', async ({ page, testData, browser }) => {
    await loginTeacherOnInstructorCourses(page, testData.teacher);
    const courseId = await createDraftCourse(page, `Conflict Course ${Date.now()}`);

    await page.getByRole('button', { name: '+ Add objective' }).click();
    await page.getByLabel('Learning objective 1').fill('First edit');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 });

    // A second, independent browser context — its own storage/tokens, same
    // account — loads the course at the editVersion tab A just saved.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginTeacherOnInstructorCourses(pageB, testData.teacher);
    await pageB.goto(`/instructor/courses/${courseId}/plan/learners`);
    await expect(pageB.getByLabel('Learning objective 1')).toHaveValue('First edit');

    // Tab A saves again, bumping editVersion past what tab B is holding.
    await page.getByLabel('Learning objective 1').fill('Tab A second edit');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 });

    // Tab B's write now carries a stale editVersion and 409s.
    await pageB.getByLabel('Learning objective 1').fill('Tab B edit attempt');
    const conflictDialog = pageB.getByRole('alertdialog').filter({ hasText: 'This course was changed elsewhere' });
    await expect(conflictDialog).toBeVisible({ timeout: 10_000 });

    await conflictDialog.getByRole('button', { name: 'Reload latest' }).click();
    await expect(pageB.getByLabel('Learning objective 1')).toHaveValue('Tab A second edit');
    await expect(conflictDialog).not.toBeVisible();

    await contextB.close();
  });

  test('leaving mid-save prompts to confirm', async ({ page, testData }) => {
    await loginTeacherOnInstructorCourses(page, testData.teacher);
    await createDraftCourse(page, `Unsaved Guard Course ${Date.now()}`);

    // Holds the autosave PATCH open so the test can reliably interact with
    // the app while it's genuinely still "saving", not racing a fast
    // real response.
    let releaseSave: () => void = () => {};
    const saveHeld = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    await page.route('**/instructor/courses/*/learners', async (route) => {
      await saveHeld;
      await route.continue();
    });

    await page.getByRole('button', { name: '+ Add objective' }).click();
    await page.getByLabel('Learning objective 1').fill('Edit while leaving');
    await expect(page.getByText('Saving…')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'My courses' }).click();
    const leaveDialog = page.getByRole('alertdialog').filter({ hasText: 'Leave without saving?' });
    await expect(leaveDialog).toBeVisible();

    await leaveDialog.getByRole('button', { name: 'Stay on this page' }).click();
    await expect(leaveDialog).not.toBeVisible();
    await expect(page.getByLabel('Learning objective 1')).toHaveValue('Edit while leaving');

    releaseSave();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 });
  });
});
