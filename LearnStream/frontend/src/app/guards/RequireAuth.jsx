import { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthContext from '@/contexts/AuthProvider';

// Route guard for anything that requires being logged in (any role). Renders
// nothing while auth status is still 'unknown' rather than bouncing to
// /login prematurely — the non-blocking AuthProvider means that window is
// typically a single render, not a network round trip visible to the user.
export function RequireAuth() {
  const { status } = useContext(AuthContext);
  const location = useLocation();

  if (status === 'unknown') return null;

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default RequireAuth;
