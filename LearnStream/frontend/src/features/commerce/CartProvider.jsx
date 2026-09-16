import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import AuthContext from '@/contexts/AuthProvider';
import { normalizeApiError } from '@/lib/api/errors';
import { useGuestCartStore } from './guestCartStore';
import { addToCartRequest, fetchCart, mergeCartRequest, removeFromCartRequest } from './api';
import { cartKeys, meSummaryKeys } from './queryKeys';

// useCart() (docs/contracts/stubs.md — frozen signature):
//   useCart() -> { mode, items, count, isLoading, has(id), add(courseCardDto), remove(id), canPurchase }
//
// `mode` is derived from AuthProvider's `status`/`auth.role`, never stored
// itself — 'guest' while logged out (or auth status is still resolving,
// H-NFR-1.3's non-blocking bootstrap: a guest-shaped cart renders
// immediately rather than waiting on the refresh check), 'server' for a
// student, 'disabled' for a teacher (no cart concept at all).
function useCartMode() {
  const { auth, status } = useContext(AuthContext);
  if (status === 'authenticated' && auth?.role === 'teacher') return 'disabled';
  if (status === 'authenticated' && auth?.role === 'student') return 'server';
  return 'guest';
}

export function useCart() {
  const mode = useCartMode();
  const queryClient = useQueryClient();

  const guestItems = useGuestCartStore((state) => state.items);
  const guestAdd = useGuestCartStore((state) => state.add);
  const guestRemove = useGuestCartStore((state) => state.remove);

  const cartQuery = useQuery({
    queryKey: cartKeys.all,
    queryFn: fetchCart,
    enabled: mode === 'server',
    staleTime: 30 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (courseCardDto) => addToCartRequest(courseCardDto.id),
    onMutate: async (courseCardDto) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all });
      const previous = queryClient.getQueryData(cartKeys.all) ?? [];
      if (!previous.some((item) => item.id === courseCardDto.id)) {
        queryClient.setQueryData(cartKeys.all, [...previous, courseCardDto]);
      }
      return { previous };
    },
    onError: (error, _courseCardDto, context) => {
      if (context) queryClient.setQueryData(cartKeys.all, context.previous);
      toast.error(normalizeApiError(error).message);
    },
    onSuccess: (items) => queryClient.setQueryData(cartKeys.all, items),
  });

  const removeMutation = useMutation({
    mutationFn: (courseId) => removeFromCartRequest(courseId),
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all });
      const previous = queryClient.getQueryData(cartKeys.all) ?? [];
      queryClient.setQueryData(cartKeys.all, previous.filter((item) => item.id !== courseId));
      return { previous };
    },
    onError: (error, _courseId, context) => {
      if (context) queryClient.setQueryData(cartKeys.all, context.previous);
      toast.error(normalizeApiError(error).message);
    },
    onSuccess: (items) => queryClient.setQueryData(cartKeys.all, items),
  });

  const items = useMemo(
    () => (mode === 'server' ? cartQuery.data ?? [] : mode === 'guest' ? guestItems : []),
    [mode, cartQuery.data, guestItems]
  );

  const has = useCallback((id) => items.some((item) => item.id === id), [items]);

  const add = useCallback(
    (courseCardDto) => {
      if (mode === 'guest') guestAdd(courseCardDto);
      else if (mode === 'server') addMutation.mutate(courseCardDto);
    },
    [mode, guestAdd, addMutation]
  );

  const remove = useCallback(
    (id) => {
      if (mode === 'guest') guestRemove(id);
      else if (mode === 'server') removeMutation.mutate(id);
    },
    [mode, guestRemove, removeMutation]
  );

  return {
    mode,
    items,
    count: items.length,
    isLoading: mode === 'server' && cartQuery.isLoading,
    has,
    add,
    remove,
    // Checkout needs a logged-in student session (plan §2.3: "Checkout
    // requires login") — a guest cart is browseable but never purchasable
    // directly, and a teacher has no cart at all.
    canPurchase: mode === 'server',
  };
}

// Wraps the app (app/providers.jsx). Runs the merge-on-login effect (plan
// §2.3): once AuthProvider resolves to an authenticated student, POST the
// guest cart's course ids to /courses/cart/merge (idempotent server-side —
// see cart.controller.js) and clear the local guest cart ONLY on a 2xx
// response, so a failed merge never silently drops what was in it.
export function CartProvider({ children }) {
  const { auth, status } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const guestItems = useGuestCartStore((state) => state.items);
  const clearGuestCart = useGuestCartStore((state) => state.clear);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || auth?.role !== 'student') return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    if (guestItems.length === 0) return;

    mergeCartRequest(guestItems.map((item) => item.id))
      .then(() => {
        clearGuestCart();
        queryClient.invalidateQueries({ queryKey: cartKeys.all });
        queryClient.invalidateQueries({ queryKey: meSummaryKeys.all });
      })
      .catch(() => {
        // Left un-cleared on purpose — the guest cart survives so nothing
        // purchasable is silently lost, and a future mount can retry.
        attemptedRef.current = false;
      });
    // guestItems is read once at the moment `status` flips to
    // 'authenticated', not re-run on every later guest-cart mutation — the
    // attemptedRef guard makes that safe to omit from deps without an
    // exhaustive-deps warning changing behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, auth?.role]);

  return children;
}

export default CartProvider;
