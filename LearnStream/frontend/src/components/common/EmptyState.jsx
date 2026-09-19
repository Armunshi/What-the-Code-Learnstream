import { cn } from '@/lib/utils';

// Generic "there's nothing here yet" panel — an empty wishlist, an empty
// cart, a course with no reviews yet, etc. Feature lanes pass their own
// icon/title/copy/action rather than each hand-rolling their own layout.
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center',
        className
      )}
    >
      {Icon ? <Icon className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" /> : null}
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
