import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import AuthContext from '@/contexts/AuthProvider';
import { normalizeApiError } from '@/lib/api/errors';
import { addToWishlist, getWishlist, removeFromWishlist } from './api';
import { wishlistKeys } from './queryKeys';

// One shared query per session (not one per WishlistButton instance) — every
// card on a page reads the same cache entry via this hook, so a page with
// dozens of CourseCards only ever fetches the wishlist once.
export function useWishlistQuery() {
  const { status } = useContext(AuthContext);
  return useQuery({
    queryKey: wishlistKeys.all(),
    queryFn: getWishlist,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useToggleWishlist(courseId) {
  const queryClient = useQueryClient();
  const { data: items = [] } = useWishlistQuery();
  const isWishlisted = items.some((item) => item.id === courseId);

  const onSettled = (nextItems) => {
    if (nextItems) queryClient.setQueryData(wishlistKeys.all(), nextItems);
  };
  const onError = (error) => toast.error(normalizeApiError(error).message);

  const addMutation = useMutation({
    mutationFn: () => addToWishlist(courseId),
    onSuccess: onSettled,
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: () => removeFromWishlist(courseId),
    onSuccess: onSettled,
    onError,
  });

  const toggle = () => {
    if (isWishlisted) removeMutation.mutate();
    else addMutation.mutate();
  };

  return { isWishlisted, toggle, isLoading: addMutation.isPending || removeMutation.isPending };
}
