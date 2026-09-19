import axios from 'axios';

// publicClient is for guest-facing reads (catalog, categories, search,
// course page, reviews) that must work identically for a logged-out visitor.
//
// It deliberately carries NO credentials and NO interceptors: it must never
// send cookies, never attach a Bearer token, and never trigger a refresh or
// a 401 redirect (H-FR-3.2, docs/contracts/api-conventions.md). Mixing this
// client's calls with privateClient's refresh logic would mean a guest page
// could silently kick off a token refresh (or worse, an auth redirect) just
// because one of its background requests happened to 401 — publicClient
// can't 401 into anything, because it never claims to be authenticated in
// the first place.
export const publicClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
  withCredentials: false,
});

export default publicClient;
