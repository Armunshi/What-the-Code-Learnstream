import { formatPaise } from '@/lib/money';
import { cn } from '@/lib/utils';

// Renders a course price in paise. price === 0 always means "Free" — never
// "₹0" — per the free-course rules in api-conventions.md/D10.
export function Price({ price, originalPrice, className }) {
  if (price === 0) {
    return <span className={cn('font-semibold text-foreground', className)}>Free</span>;
  }

  const hasDiscount = typeof originalPrice === 'number' && originalPrice > price;

  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-semibold text-foreground">{formatPaise(price)}</span>
      {hasDiscount ? (
        <span className="text-sm text-muted-foreground line-through">{formatPaise(originalPrice)}</span>
      ) : null}
    </span>
  );
}

export default Price;
