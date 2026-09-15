import { useCallback, useContext } from 'react';
import { create } from 'zustand';
import AuthContext from '@/contexts/AuthProvider';

// Shared (module-level) dialog state so LoginPromptDialog — mounted once
// near the app root — and every requireAuth() caller anywhere in the tree
// talk to the same instance instead of each guest action needing its own
// dialog.
export const useLoginPromptStore = create((set) => ({
  isOpen: false,
  pendingAction: null,
  open: (pendingAction) => set({ isOpen: true, pendingAction }),
  close: () => set({ isOpen: false, pendingAction: null }),
}));

// useRequireAuth() -> { requireAuth(action) }
//
// A guest-gated action (add to cart, vote helpful, add to wishlist) calls
// requireAuth(() => doTheThing()) instead of calling doTheThing() directly.
// Already-authenticated viewers run the action immediately; guests get
// LoginPromptDialog instead, and the action is meant to resume after a
// successful login (plan §2.8: "A guest action opens LoginPromptDialog via
// useRequireAuth(), then resumes after login").
//
// Wave 0 stub: the open/store plumbing is real, but nothing currently
// resumes `pendingAction` after a successful login — that needs an actual
// login form inside LoginPromptDialog wired to AuthProvider, which is Wave 1
// work for whichever lane owns the first real guest-gated action.
export function useRequireAuth() {
  const { status } = useContext(AuthContext);
  const open = useLoginPromptStore((state) => state.open);

  const requireAuth = useCallback(
    (action) => {
      if (status === 'authenticated') {
        action?.();
        return;
      }
      open(action);
    },
    [status, open]
  );

  return { requireAuth };
}

export default useRequireAuth;
