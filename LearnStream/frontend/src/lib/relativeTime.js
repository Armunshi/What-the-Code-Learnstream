// Built on the built-in Intl.RelativeTimeFormat — no date library dependency
// on purpose (a later lane's lib/relativeTime.js consumer expects exactly
// this, per the Wave 0 plan).

const DIVISIONS = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// formatRelativeTime(new Date(Date.now() - 3600_000)) -> "1 hour ago"
// formatRelativeTime('2026-09-01T00:00:00Z') -> "2 weeks ago"
export function formatRelativeTime(input, now = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return '';
}

export default formatRelativeTime;
