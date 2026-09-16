import { publicClient } from '@/lib/api/publicClient';
import { privateClient } from '@/lib/api/privateClient';

// GET /courses/categories is guest-facing (H-FR-3.2) — always through
// publicClient, never privateClient, even though a logged-in viewer also
// calls it from ExploreMenu.
export async function fetchCategories() {
  const { data } = await publicClient.get('/courses/categories');
  return data.data.categories;
}

// GET /users/me/summary (docs/contracts/dto.md) backs UserMenu's "N courses
// enrolled" label and avatar. Only ever called for an authenticated viewer
// (see useCurrentUser's `enabled` guard) since the endpoint 401s otherwise.
export async function fetchMeSummary() {
  const { data } = await privateClient.get('/users/me/summary');
  return data.data;
}

// POST /user/:role/logout invalidates the refresh token + clears its cookie
// server-side (backend/src/controllers/UserAuth/auth.controller.js). A 401
// here (already-expired/rotated token) still means the caller ends up
// signed out locally, so useLogout treats it as a success either way.
export async function requestLogout(role) {
  await privateClient.post(`/user/${role}/logout`);
}
