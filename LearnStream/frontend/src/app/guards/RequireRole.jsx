import { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthContext from '@/contexts/AuthProvider';

// Like RequireAuth, but also checks the logged-in user's role (e.g. only a
// teacher may reach instructor authoring routes). `roles` accepts one role
// string or an array.
export function RequireRole({ roles }) {
  const { auth, status } = useContext(AuthContext);
  const location = useLocation();
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (status === 'unknown') return null;

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowed.includes(auth?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default RequireRole;
