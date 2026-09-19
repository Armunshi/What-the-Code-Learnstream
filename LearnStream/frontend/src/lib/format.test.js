import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatCount, formatHoursMinutes } from './format';

describe('formatHoursMinutes', () => {
  it('renders hours and minutes together', () => {
    expect(formatHoursMinutes(45150)).toBe('12h 33m'); // ceil(45150/60)=753 -> 12h 33m
  });

  it('renders minutes only when under an hour', () => {
    expect(formatHoursMinutes(1800)).toBe('30m');
  });

  it('renders hours only on an exact hour', () => {
    expect(formatHoursMinutes(7200)).toBe('2h');
  });

  it('rounds a sub-minute duration up to 1m instead of 0m', () => {
    expect(formatHoursMinutes(59)).toBe('1m');
  });

  it('treats 0 or missing input as 0m', () => {
    expect(formatHoursMinutes(0)).toBe('0m');
    expect(formatHoursMinutes(undefined)).toBe('0m');
  });
});

describe('formatCount', () => {
  it('groups thousands with commas', () => {
    expect(formatCount(56145)).toBe('56,145');
  });

  it('handles small numbers with no separators', () => {
    expect(formatCount(42)).toBe('42');
  });

  it('treats missing input as 0', () => {
    expect(formatCount(undefined)).toBe('0');
  });
});

describe('formatCompactNumber', () => {
  it('compacts numbers at or above 1,000', () => {
    expect(formatCompactNumber(56145)).toBe('56.1K');
  });

  it('compacts large numbers using Indian lakh/crore grouping (en-IN)', () => {
    expect(formatCompactNumber(1200000)).toBe('12L');
  });

  it('falls back to the plain count below 1,000', () => {
    expect(formatCompactNumber(742)).toBe('742');
  });
});
