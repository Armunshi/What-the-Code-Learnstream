import { test, expect } from '../fixtures/test-data.fixture.js';
import { KNOWN_CONSOLE_NOISE } from '../lib/console-allowlist.js';
import { readSeed } from '../lib/seed-registry.js';

interface SearchSeed {
  query: string;
  courses: Array<{ id: string; title: string }>;
}

// GlobalSearch (docs/contracts/stubs.md, plan §4 W1-SRC) isn't reachable from
// SiteHeader yet — NAV (the lane that mounts it there per stubs.md's own
// header layout) hasn't merged. SearchResultsPage mounts its own
// `<GlobalSearch variant="inline"/>` at the top specifically so this behavior
// is exercisable at all; once NAV lands, the same input becomes reachable
// from every page too, with no change needed here.
test.describe('GlobalSearch suggestions', () => {
  test('empty focus shows a trending list', async ({ page }) => {
    await page.goto('/courses/search');

    const trendingResponse = page.waitForResponse((r) => r.url().includes('/courses/search/trending'));
    await page.getByTestId('global-search-input').click();
    const response = await trendingResponse;
    expect(response.status()).toBe(200);

    await expect(page.getByTestId('global-search-trending')).toBeVisible();
    await expect(page.getByTestId('global-search-trending-item').first()).toBeVisible();
  });

  test('typing sends exactly one debounced suggest request for the settled value', async ({ page, networkLogger }) => {
    await page.goto('/courses/search');
    const input = page.getByTestId('global-search-input');
    await input.click();

    // Types four keystrokes back to back; only the value that's still
    // current 200ms after the LAST one should ever reach the network —
    // GlobalSearch.jsx keys its suggest useQuery on the debounced value,
    // not on every keystroke, precisely so a fast typist never fires one
    // request per character.
    await input.pressSequentially('java', { delay: 20 });
    await page.waitForResponse((r) => r.url().includes('/courses/search/suggest') && r.url().includes('q=java'));
    await page.waitForTimeout(300); // past the 200ms debounce, to catch any straggler request

    const suggestCalls = networkLogger.getEntries().filter((e) => e.url.includes('/courses/search/suggest'));
    expect(suggestCalls).toHaveLength(1);
    expect(suggestCalls[0].status).toBe(200);

    await expect(page.getByTestId('global-search-suggestions')).toBeVisible();
    expect(networkLogger.getConsoleErrors(KNOWN_CONSOLE_NOISE)).toEqual([]);
  });

  test('Enter navigates to /courses/search?q=', async ({ page }) => {
    const seed = readSeed<SearchSeed>('search');
    await page.goto('/courses/search');

    const input = page.getByTestId('global-search-input');
    await input.click();
    await input.fill(seed.query);
    await input.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/courses/search\\?q=${seed.query}`));
  });

  test('selecting a suggested course navigates to its course page', async ({ page }) => {
    const seed = readSeed<SearchSeed>('search');
    await page.goto('/courses/search');

    const input = page.getByTestId('global-search-input');
    await input.click();
    await input.pressSequentially(seed.query);
    await page.waitForResponse((r) => r.url().includes('/courses/search/suggest'));

    const firstCourseItem = page.getByTestId('global-search-course-item').first();
    await expect(firstCourseItem).toBeVisible();
    await firstCourseItem.click();

    await expect(page).toHaveURL(/\/course\/[a-f0-9]{24}/);
  });
});
