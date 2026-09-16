import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PRACTICE_OPTIONS, RATING_OPTIONS, LEVEL_OPTIONS, languageLabel } from '../filterConfig.js';
import { CheckboxFilterGroup, RadioFilterGroup } from './FilterGroups.jsx';

// "High-frequency groups (Hands-on practice, Language, Ratings, Level) above
// the grid, plus an All filters button" (plan §6.3). Language's options
// aren't a fixed list like the others — only languages the facet actually
// reports get a row, since there's no static "every language" list to draw
// from otherwise.
export function QuickFilterBar({ filters, facets, toggleValue, setRadio, onOpenAllFilters }) {
  const languageOptions = Object.keys(facets?.lang ?? {}).map((code) => ({ value: code, label: languageLabel(code) }));

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="quick-filter-bar">
      <QuickFilterPopover label="Hands-on practice" group="practice">
        <CheckboxFilterGroup
          label="Hands-on practice"
          group="practice"
          options={PRACTICE_OPTIONS}
          selected={filters.practice}
          counts={facets?.practice}
          onToggle={toggleValue}
          source="quick"
        />
      </QuickFilterPopover>

      {languageOptions.length > 0 ? (
        <QuickFilterPopover label="Language" group="lang">
          <CheckboxFilterGroup
            label="Language"
            group="lang"
            options={languageOptions}
            selected={filters.lang}
            counts={facets?.lang}
            onToggle={toggleValue}
            source="quick"
          />
        </QuickFilterPopover>
      ) : null}

      <QuickFilterPopover label="Ratings" group="rating">
        <RadioFilterGroup
          label="Minimum rating"
          group="rating"
          options={RATING_OPTIONS}
          selected={filters.rating}
          counts={facets?.rating}
          onSelect={setRadio}
          source="quick"
        />
      </QuickFilterPopover>

      <QuickFilterPopover label="Level" group="level">
        <CheckboxFilterGroup
          label="Level"
          group="level"
          options={LEVEL_OPTIONS}
          selected={filters.level}
          counts={facets?.level}
          onToggle={toggleValue}
          source="quick"
        />
      </QuickFilterPopover>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        data-testid="all-filters-button"
        onClick={onOpenAllFilters}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        All filters
      </Button>
    </div>
  );
}

function QuickFilterPopover({ label, group, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0" data-testid={`quick-filter-trigger-${group}`}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default QuickFilterBar;
