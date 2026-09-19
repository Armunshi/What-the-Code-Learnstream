import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Renders the autosave state machine (idle/saving/saved/error/conflict —
// plan §2.4) as a small inline status, shown next to a form group and in
// CourseAuthoringHeader (C-UI-9 "success feedback").
export function SaveStatus({ state, error, onRetry, className }) {
  if (state === 'idle') return null;

  if (state === 'saving') {
    return (
      <span className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }

  if (state === 'saved') {
    return (
      <span className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)} role="status">
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Saved
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className={cn('flex items-center gap-1.5 text-sm text-destructive', className)} role="alert">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {error?.message || "Couldn't save"}
        {onRetry ? (
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-destructive underline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </span>
    );
  }

  // 'conflict' has no inline rendering of its own — ConflictDialog owns that
  // state's UI (a blocking dialog, not an inline status line).
  return null;
}

export default SaveStatus;
