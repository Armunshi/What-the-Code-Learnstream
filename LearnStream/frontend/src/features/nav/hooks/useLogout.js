import { useCallback, useContext } from 'react';
import AuthContext from '@/contexts/AuthProvider';
import { tokenStore } from '@/lib/api/tokenStore';
import { requestLogout } from '../api';

// AuthProvider subscribes to tokenStore and derives `auth`/`status` from
// whatever token is current (contexts/AuthProvider.jsx), so clearing the
// token here is the entire "log the user out" step — no separate call is
// needed to reset `auth`/`status` in context. window.location.assign is
// still used (rather than useNavigate) to force a full reload, discarding
// any in-memory query cache/component state left over from the session.
export function useLogout() {
  const { auth } = useContext(AuthContext);

  return useCallback(async () => {
    try {
      if (auth?.role) {
        await requestLogout(auth.role);
      }
    } catch {
      // Server-side session was already gone (expired/rotated token) — the
      // local sign-out below still needs to happen.
    } finally {
      tokenStore.clearToken();
      window.location.assign('/');
    }
  }, [auth?.role]);
}

export default useLogout;
