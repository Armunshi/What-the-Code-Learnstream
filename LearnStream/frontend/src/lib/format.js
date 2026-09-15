// Formatting helpers shared across every feature — kept dependency-free
// (no date/number library) so Wave 1 lanes don't each reach for a different
// one.

// Durations are always seconds on the wire (durationSec, totalDurationSec —
// api-conventions.md). This renders them the way a course header does:
// 45150 -> "12h 32m", 1800 -> "30m", 59 -> "1m" (rounds up so a
// sub-minute duration never displays as "0m").
export function formatHoursMinutes(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// Plain thousands-grouped count, e.g. 56145 -> "56,145" — used wherever the
// exact number matters (rating counts, enrollment counts in a detail view).
export function formatCount(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value) || 0);
}

// Compact form for tight spaces (card badges, stat tiles), e.g.
// 56145 -> "56.1K", 1200000 -> "12L" (en-IN compact notation switches to
// lakh/crore above 100,000, matching how those figures are actually read on
// an India-focused platform). Falls back to the plain count below 1,000 so
// small numbers aren't compacted into something less readable.
export function formatCompactNumber(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 1000) return formatCount(number);
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
}
