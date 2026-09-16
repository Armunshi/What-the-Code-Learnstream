import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AuthContext from '@/contexts/AuthProvider';
import { fetchMeSummary } from '../api';
import { meSummaryKeys } from '../queryKeys';

// contexts/AuthProvider.jsx's authFromToken() keeps only {user_id, name,
// role} off the access token's payload — it drops `email`, which UserMenu's
// label needs ("name, email, N courses enrolled", plan §5.1). Decoding it
// again here (the exact same non-verifying atob split AuthProvider already
// does) avoids editing contexts/AuthProvider.jsx, which isn't part of this
// lane's ownership (docs/lanes/nav.json).
function decodeEmail(accessToken) {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return payload?.email ?? null;
  } catch {
    return null;
  }
}

export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

// Combines AuthProvider's context (name, role, status) with the email
// hidden in the token payload and GET /users/me/summary's avatar/
// enrolledCount (S-FR-4.2's "real-time user state", not a hardcoded mock).
export function useCurrentUser() {
  const { auth, status } = useContext(AuthContext);
  const email = useMemo(() => decodeEmail(auth?.accessToken), [auth?.accessToken]);

  const summary = useQuery({
    queryKey: meSummaryKeys.all,
    queryFn: fetchMeSummary,
    enabled: status === 'authenticated',
    staleTime: 60 * 1000,
  });

  return {
    status,
    role: auth?.role ?? null,
    name: auth?.name ?? null,
    email,
    initials: getInitials(auth?.name),
    avatar: summary.data?.avatar ?? null,
    enrolledCount: summary.data?.enrolledCount ?? 0,
    isLoading: status === 'authenticated' && summary.isLoading,
  };
}

export default useCurrentUser;
