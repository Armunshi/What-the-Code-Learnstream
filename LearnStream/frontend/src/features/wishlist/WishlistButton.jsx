import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useToggleWishlist } from './useWishlist';

// Frozen signature (docs/contracts/stubs.md): WishlistButton({courseId}).
// Rendered both standalone (course page PreviewCard) and inside
// CoursePopover, which itself sits inside a course card's clickable region —
// stopPropagation/preventDefault keep a click here from also triggering
// whatever wraps it.
export function WishlistButton({ courseId }) {
  const { requireAuth } = useRequireAuth();
  const { isWishlisted, toggle, isLoading } = useToggleWishlist(courseId);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isWishlisted}
      disabled={isLoading}
      data-testid="wishlist-button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        requireAuth(toggle);
      }}
    >
      <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current text-red-500')} aria-hidden="true" />
    </Button>
  );
}

export default WishlistButton;
