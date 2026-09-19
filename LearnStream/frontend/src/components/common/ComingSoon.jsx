import { Construction } from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder for menu entries/pages that exist in the IA but aren't built
// yet (e.g. "Messages" in UserMenu, per stubs.md's SiteHeader composition).
// Lets NAV and others wire up the full menu now without waiting on the
// feature behind each entry.
export function ComingSoon({ title = 'Coming soon', description = "We're still building this.", className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 p-10 text-center', className)}>
      <Construction className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default ComingSoon;
