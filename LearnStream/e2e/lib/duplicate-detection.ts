// Pure functions over a captured network log — kept independent of
// Playwright/live timing so each check can be tested in isolation and so
// detection logic never itself races against the page it's analyzing.
import type { NetworkEntry, DuplicateFindings } from './log-writer.js';

export function findDuplicatePosts(
  log: NetworkEntry[],
  urlPattern: RegExp = /.*/
): Array<{ url: string; occurrences: number }> {
  const posts = log.filter((e) => e.method === 'POST' && urlPattern.test(e.url));
  const byUrl = new Map<string, number>();
  for (const p of posts) byUrl.set(p.url, (byUrl.get(p.url) ?? 0) + 1);
  return [...byUrl.entries()]
    .filter(([, count]) => count > 1)
    .map(([url, occurrences]) => ({ url, occurrences }));
}

export function findRapidDuplicateGets(
  log: NetworkEntry[],
  windowMs = 500
): Array<{ url: string; deltaMs: number }> {
  const gets = log.filter((e) => e.method === 'GET');
  const byUrl = new Map<string, NetworkEntry[]>();
  for (const g of gets) {
    const arr = byUrl.get(g.url) ?? [];
    arr.push(g);
    byUrl.set(g.url, arr);
  }

  const findings: Array<{ url: string; deltaMs: number }> = [];
  for (const [url, entries] of byUrl) {
    const sorted = [...entries].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    for (let i = 1; i < sorted.length; i++) {
      const deltaMs = Date.parse(sorted[i].timestamp) - Date.parse(sorted[i - 1].timestamp);
      if (deltaMs <= windowMs) findings.push({ url, deltaMs });
    }
  }
  return findings;
}

export function findBackToBackOptions(
  log: NetworkEntry[]
): Array<{ url: string; occurrences: number }> {
  const options = log.filter((e) => e.method === 'OPTIONS');
  const byUrl = new Map<string, number>();
  for (const o of options) byUrl.set(o.url, (byUrl.get(o.url) ?? 0) + 1);
  return [...byUrl.entries()]
    .filter(([, count]) => count > 1)
    .map(([url, occurrences]) => ({ url, occurrences }));
}

export function buildDuplicateFindings(
  log: NetworkEntry[],
  duplicatePostUrlPattern: RegExp = /.*/
): DuplicateFindings {
  return {
    duplicatePosts: findDuplicatePosts(log, duplicatePostUrlPattern),
    rapidDuplicateGets: findRapidDuplicateGets(log),
    backToBackOptions: findBackToBackOptions(log),
  };
}
