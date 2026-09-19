import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/common/Price';
import { Skeleton } from '@/components/ui/skeleton';
import AuthContext from '@/contexts/AuthProvider';
import { displayRazorpay } from '@/Pages/displayRazorpay';
import { useCart } from './CartProvider';

// CartPage at /cart (plan's W1-COM task list). Renders the same shape
// regardless of useCart().mode: guest items come from localStorage, a
// student's from the server — the viewer never has to know which.
export function CartPage() {
  const { auth, status } = useContext(AuthContext);
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const total = cart.items.reduce((sum, item) => sum + (item.priceInPaise ?? 0), 0);

  const handleCheckout = () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    displayRazorpay({
      course_ids: cart.items.map((item) => item.id),
      studentName: auth?.name,
      queryClient,
      navigate,
      onSettled: () => setCheckoutLoading(false),
      onError: setCheckoutError,
    });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8" data-testid="cart-page">
      <h1 className="text-2xl font-semibold">Shopping cart</h1>

      {cart.isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : cart.items.length === 0 ? (
        <p className="text-muted-foreground" data-testid="cart-empty">
          Your cart is empty.{' '}
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            Browse courses
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          <ul className="flex flex-1 flex-col gap-4" data-testid="cart-items">
            {cart.items.map((item) => (
              <li
                key={item.id}
                data-testid="cart-item"
                className="grid grid-cols-[96px_1fr_auto] items-center gap-4 border-b pb-4"
              >
                <Link to={`/course/${item.id}`}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-muted" />
                  )}
                </Link>
                <div className="min-w-0">
                  <Link to={`/course/${item.id}`} className="line-clamp-2 font-semibold hover:underline">
                    {item.title}
                  </Link>
                  {item.author?.name ? <p className="text-sm text-muted-foreground">{item.author.name}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <Price price={item.priceInPaise} />
                  <button
                    type="button"
                    onClick={() => cart.remove(item.id)}
                    data-testid="cart-item-remove"
                    aria-label={`Remove ${item.title} from cart`}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex w-full flex-col gap-4 rounded-xl border bg-muted/30 p-4 md:w-80">
            <h2 className="text-lg font-semibold">Total</h2>
            <div className="flex items-center justify-between text-sm">
              <span>
                {cart.items.length} item{cart.items.length === 1 ? '' : 's'}
              </span>
              <Price price={total} />
            </div>

            {checkoutError ? (
              <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{checkoutError}</p>
            ) : null}

            {cart.canPurchase ? (
              <Button onClick={handleCheckout} disabled={checkoutLoading} data-testid="cart-checkout">
                {checkoutLoading ? 'Processing…' : 'Proceed to checkout'}
              </Button>
            ) : (
              <Button asChild data-testid="cart-login-to-checkout">
                <Link to={`/login?next=${encodeURIComponent('/cart')}`}>Log in to check out</Link>
              </Button>
            )}
            {status !== 'authenticated' ? (
              <p className="text-xs text-muted-foreground">
                Your cart is saved on this device — log in to check out and sync it across devices.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;
