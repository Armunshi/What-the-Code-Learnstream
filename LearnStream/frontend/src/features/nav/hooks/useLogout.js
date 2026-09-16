import { useCallback, useContext } from 'react';
import AuthContext from '@/contexts/AuthProvider';
import { tokenStore } from '@/lib/api/tokenStore';
import { requestLogout } from '../api';

// AuthProvider exposes `status` ('unknown' | 'authenticated' | 'guest') with
// no external setter, and only re-derives it from a fresh mount's rehydrate()
// effect or the axios.js `authUpdater` callback registered internally to
// itself (neither reachable from outside contexts/AuthProvider.jsx, which
// isn't part of this lane's ownership). A full navigation is therefore the
// only way from here to get `status` to flip to 'guest' after logout — a
// plain `setAuth({})` would clear the visible name/avatar but leave `status`
// stuck at 'authenticated', rendering a broken UserMenu instead of AuthCtas.
// Flagged in the final report as a candidate amendment (AuthProvider
// subscribing to tokenStore, which its own doc comment already says it
// should) so a future lane can make this instant instead.
export function useLogout() {
  const { auth, setAuth } = useContext(AuthContext);

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
      setAuth({});
      window.location.assign('/');
    }
  }, [auth?.role, setAuth]);
}

export default useLogout;
