import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Expandable description (plan's W1-CAT task list). Collapsed to a fixed
// clamp height so a long description doesn't push the curriculum far down
// the page; "Show more"/"Show less" toggles the full text.
export function Description({ description }) {
  const [open, setOpen] = useState(false);

  if (!description) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">Description</h2>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
        <CollapsibleContent forceMount className={cn('whitespace-pre-line text-sm text-foreground', !open && 'line-clamp-6')}>
          {description}
        </CollapsibleContent>
        <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {open ? 'Show less' : 'Show more'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </CollapsibleTrigger>
      </Collapsible>
    </section>
  );
}

export default Description;
