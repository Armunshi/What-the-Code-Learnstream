import { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthContext from '@/contexts/AuthProvider';

// A local stand-in for app/guards/RequireRole (owned by W0-A/AUTH, not this
// lane) pending a fix there: Pages/login.jsx's handleLogin calls `setAuth(…)`
// on a successful login but never calls `setStatus('authenticated')` — confirmed
// live via the e2e suite. `status` is left at whatever the boot-time
// rehydrate-from-cookie effect resolved it to, which for anyone who just
// logged in from /login is 'guest' (that's why they were on /login in the
// first place). RequireRole/RequireAuth gate on `status` alone, so they'd
// bounce a freshly-logged-in teacher straight back to /login before they
// ever reach an authoring route.
//
// This checks `auth.role` directly instead (set correctly and synchronously
// by every login path), and only defers to `status` for the one thing it IS
// reliable for: the brief 'unknown' window while the boot-time refresh-token
// check is still in flight, where there's no `auth` to read yet either way.
// TODO(AUTH lane): once login.jsx/AuthProvider.jsx keep `status` and `auth`
// in sync on login, this can be deleted in favor of the shared RequireRole.
export function RequireTeacher() {
  const { auth, status } = useContext(AuthContext);
  const location = useLocation();

  if (status === 'unknown') return null;

  if (!auth?.accessToken || auth?.role !== 'teacher') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default RequireTeacher;
