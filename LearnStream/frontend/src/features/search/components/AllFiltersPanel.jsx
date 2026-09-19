import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  RATING_OPTIONS,
  DURATION_OPTIONS,
  LEVEL_OPTIONS,
  PRICE_OPTIONS,
  PRACTICE_OPTIONS,
  languageLabel,
  topicLabel,
} from '../filterConfig.js';
import { CheckboxFilterGroup, RadioFilterGroup, SwitchFilterRow } from './FilterGroups.jsx';

/** Every filter group (plan §6.3's full table), rendered identically
 * whether it's inside the Sheet (below `lg`) or the sticky aside (`lg`+) —
 * only the wrapping chrome differs, per `source`. */
function AllFiltersBody({ filters, facets, toggleValue, setRadio, setCert, hasActiveFilters, clearAll, source }) {
  const languageOptions = Object.keys(facets?.lang ?? {}).map((code) => ({ value: code, label: languageLabel(code) }));
  const subsOptions = Object.keys(facets?.subs ?? {}).map((code) => ({ value: code, label: languageLabel(code) }));
  const topicOptions = Object.keys(facets?.topic ?? {}).map((slug) => ({ value: slug, label: topicLabel(slug) }));

  return (
    <div className="flex flex-col gap-6" data-testid={`all-filters-body-${source}`}>
      {hasActiveFilters ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" data-testid="clear-all-filters" onClick={clearAll}>
          Clear all
        </Button>
      ) : null}

      <SwitchFilterRow label="Certification prep" checked={filters.cert} onCheckedChange={setCert} source={source} />

      <RadioFilterGroup
        label="Minimum rating"
        group="rating"
        options={RATING_OPTIONS}
        selected={filters.rating}
        counts={facets?.rating}
        onSelect={setRadio}
        source={source}
      />

      {languageOptions.length > 0 ? (
        <CheckboxFilterGroup
          label="Language"
          group="lang"
          options={languageOptions}
          selected={filters.lang}
          counts={facets?.lang}
          onToggle={toggleValue}
          source={source}
        />
      ) : null}

      <CheckboxFilterGroup
        label="Hands-on practice"
        group="practice"
        options={PRACTICE_OPTIONS}
        selected={filters.practice}
        counts={facets?.practice}
        onToggle={toggleValue}
        source={source}
      />

      <RadioFilterGroup
        label="Video duration"
        group="duration"
        options={DURATION_OPTIONS}
        selected={filters.duration}
        counts={facets?.duration}
        onSelect={setRadio}
        source={source}
      />

      {topicOptions.length > 0 ? (
        <CheckboxFilterGroup
          label="Topic"
          group="topic"
          options={topicOptions}
          selected={filters.topic}
          counts={facets?.topic}
          onToggle={toggleValue}
          source={source}
        />
      ) : null}

      <CheckboxFilterGroup
        label="Level"
        group="level"
        options={LEVEL_OPTIONS}
        selected={filters.level}
        counts={facets?.level}
        onToggle={toggleValue}
        source={source}
      />

      {subsOptions.length > 0 ? (
        <CheckboxFilterGroup
          label="Subtitles"
          group="subs"
          options={subsOptions}
          selected={filters.subs}
          counts={facets?.subs}
          onToggle={toggleValue}
          source={source}
        />
      ) : null}

      <CheckboxFilterGroup
        label="Price"
        group="price"
        options={PRICE_OPTIONS}
        selected={filters.price}
        counts={facets?.price}
        onToggle={toggleValue}
        source={source}
      />
    </div>
  );
}

/**
 * Below `lg`: a Sheet triggered by QuickFilterBar's "All filters" button.
 * At `lg` and up: a sticky aside, always visible, no open/close state.
 */
export function AllFiltersPanel({ open, onOpenChange, ...bodyProps }) {
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-80 overflow-y-auto lg:hidden" data-testid="all-filters-sheet">
          <SheetHeader>
            <SheetTitle>All filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <AllFiltersBody {...bodyProps} source="panel" />
          </div>
        </SheetContent>
      </Sheet>

      <aside className="sticky top-20 hidden h-fit w-64 shrink-0 lg:block" data-testid="all-filters-aside">
        <AllFiltersBody {...bodyProps} source="aside" />
      </aside>
    </>
  );
}

export default AllFiltersPanel;
