import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Shared filter-row primitives used by both QuickFilterBar and
// AllFiltersPanel (plan §6.3: "the panel and quick bar always agree" — both
// only ever read/write through useSearchFilters(), never their own copy of
// which values are checked). `source` namespaces each row's data-testid
// ("quick" vs "panel") purely so Playwright can tell the two renderings of
// the same control apart; it carries no other meaning.

/** Checkbox group (OR within group) — lang/practice/topic/level/subs/price. */
export function CheckboxFilterGroup({ label, group, options, selected = [], onToggle, counts, source }) {
  const visible = options.filter((o) => !o.reserved || (counts?.[o.value] ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <fieldset className="flex flex-col gap-2" data-testid={`filter-group-${source}-${group}`}>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {visible.map((option) => {
        const id = `filter-${source}-${group}-${option.value}`;
        const count = counts?.[option.value];
        return (
          <div key={option.value} className="flex items-center gap-2">
            <Checkbox
              id={id}
              data-testid={id}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(group, option.value)}
            />
            <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
              {option.label}
              {typeof count === 'number' ? <span className="ml-1 text-xs text-muted-foreground">({count})</span> : null}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Radio group (picking a new value replaces the old one) — rating/duration. */
export function RadioFilterGroup({ label, group, options, selected, onSelect, counts, source }) {
  return (
    <fieldset className="flex flex-col gap-2" data-testid={`filter-group-${source}-${group}`}>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <RadioGroup
        value={selected ?? ''}
        onValueChange={(value) => onSelect(group, value)}
      >
        {options.map((option) => {
          const id = `filter-${source}-${group}-${option.value}`;
          const count = counts?.[option.value];
          return (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem
                id={id}
                data-testid={id}
                value={option.value}
                // Clicking the already-selected radio clears it — Radix's
                // RadioGroup has no native "deselect" so this needs its own
                // onClick rather than relying on onValueChange (which never
                // fires for re-selecting the same value).
                onClick={() => {
                  if (selected === option.value) onSelect(group, option.value);
                }}
              />
              <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
                {option.label}
                {typeof count === 'number' ? <span className="ml-1 text-xs text-muted-foreground">({count})</span> : null}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

/** The one boolean switch — certification prep. */
export function SwitchFilterRow({ label, checked, onCheckedChange, source }) {
  const id = `filter-${source}-cert`;
  return (
    <div className="flex items-center justify-between gap-2" data-testid={`filter-group-${source}-cert`}>
      <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
        {label}
      </Label>
      <Switch id={id} data-testid={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default { CheckboxFilterGroup, RadioFilterGroup, SwitchFilterRow };
