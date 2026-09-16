import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  RATING_LABELS,
  DURATION_LABELS,
  LEVEL_LABELS,
  PRICE_LABELS,
  PRACTICE_LABELS,
  languageLabel,
  topicLabel,
} from '../filterConfig.js';

/** One dismissible pill per active value (plan §6.3): `[ English × ]`,
 * `[ 4.5 & up × ]`. X removes only that value — the radio groups (rating,
 * duration) go through clearRadio, the checkbox groups through removeValue. */
export function ActiveFilterChips({ filters, removeValue, clearRadio, setCert, hasActiveFilters, clearAll }) {
  if (!hasActiveFilters) return null;

  const chips = [];
  if (filters.cert) chips.push({ key: 'cert', label: 'Certification prep', onRemove: () => setCert(false) });
  if (filters.rating) {
    chips.push({ key: 'rating', label: RATING_LABELS[filters.rating] ?? filters.rating, onRemove: () => clearRadio('rating') });
  }
  if (filters.duration) {
    chips.push({
      key: 'duration',
      label: DURATION_LABELS[filters.duration] ?? filters.duration,
      onRemove: () => clearRadio('duration'),
    });
  }
  for (const code of filters.lang ?? []) {
    chips.push({ key: `lang-${code}`, label: languageLabel(code), onRemove: () => removeValue('lang', code) });
  }
  for (const value of filters.practice ?? []) {
    chips.push({ key: `practice-${value}`, label: PRACTICE_LABELS[value] ?? value, onRemove: () => removeValue('practice', value) });
  }
  for (const slug of filters.topic ?? []) {
    chips.push({ key: `topic-${slug}`, label: topicLabel(slug), onRemove: () => removeValue('topic', slug) });
  }
  for (const value of filters.level ?? []) {
    chips.push({ key: `level-${value}`, label: LEVEL_LABELS[value] ?? value, onRemove: () => removeValue('level', value) });
  }
  for (const code of filters.subs ?? []) {
    chips.push({ key: `subs-${code}`, label: languageLabel(code), onRemove: () => removeValue('subs', code) });
  }
  for (const value of filters.price ?? []) {
    chips.push({ key: `price-${value}`, label: PRICE_LABELS[value] ?? value, onRemove: () => removeValue('price', value) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 overflow-x-auto" data-testid="active-filter-chips">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
          data-testid={`active-filter-chip-${chip.key}`}
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            data-testid={`active-filter-chip-remove-${chip.key}`}
            className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
            onClick={chip.onRemove}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <Button type="button" variant="ghost" size="sm" data-testid="clear-all-filters-chip" onClick={clearAll}>
        Clear all
      </Button>
    </div>
  );
}

export default ActiveFilterChips;
