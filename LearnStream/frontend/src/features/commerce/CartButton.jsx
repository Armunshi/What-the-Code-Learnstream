import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/common/Price';
import { useHoverIntent } from '@/hooks/useHoverIntent';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useCart } from './CartProvider';

// CartButton (docs/contracts/stubs.md): `aria-label="Cart, N items"`,
// `data-testid="cart-count"`, hover preview on fine-pointer devices. Hidden
// by SiteHeader itself when useCart().mode === 'disabled' (a teacher has no
// cart at all) — this component still renders correctly if mounted anyway,
// it just has nothing to show.
export function CartButton() {
  const cart = useCart();
  const hoverIntent = useHoverIntent({ openDelay: 150, closeDelay: 150 });
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const previewEnabled = canHover;

  if (cart.mode === 'disabled') return null;

  const isOpen = previewEnabled && hoverIntent.isOpen;

  return (
    <Popover open={isOpen} onOpenChange={(next) => (next ? hoverIntent.open() : hoverIntent.close())}>
      <PopoverTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={`Cart, ${cart.count} items`}
          data-testid="cart-count"
          {...(previewEnabled ? hoverIntent.pointerHandlers : {})}
        >
          <Link to="/cart" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cart.count > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {cart.count}
              </span>
            ) : null}
          </Link>
        </Button>
      </PopoverTrigger>

      {previewEnabled ? (
        <PopoverContent
          align="end"
          className="w-80"
          data-testid="cart-preview"
          onPointerEnter={hoverIntent.pointerHandlers.onPointerEnter}
          onPointerLeave={hoverIntent.pointerHandlers.onPointerLeave}
        >
          {cart.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {cart.items.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="h-10 w-16 flex-none rounded object-cover" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                    </div>
                    <Price price={item.priceInPaise} className="text-xs" />
                  </li>
                ))}
              </ul>
              <Button asChild size="sm">
                <Link to="/cart">Go to cart</Link>
              </Button>
            </div>
          )}
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

export default CartButton;
