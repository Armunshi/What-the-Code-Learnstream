import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = new Date('2026-09-15T12:00:00Z');

describe('formatRelativeTime', () => {
  it('renders a past hour as "N hours ago"', () => {
    const anHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000);
    expect(formatRelativeTime(anHourAgo, NOW)).toBe('1 hour ago');
  });

  it('renders a past number of weeks', () => {
    const twoWeeksAgo = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoWeeksAgo, NOW)).toBe('2 weeks ago');
  });

  it('renders a future time as "in N days"', () => {
    const inThreeDays = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(inThreeDays, NOW)).toBe('in 3 days');
  });

  it('accepts an ISO date string', () => {
    expect(formatRelativeTime('2026-09-15T11:00:00Z', NOW)).toBe('1 hour ago');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('');
  });

  it('uses "now" for a sub-second difference', () => {
    const justNow = new Date(NOW.getTime() - 400);
    expect(formatRelativeTime(justNow, NOW)).toBe('now');
  });
});
