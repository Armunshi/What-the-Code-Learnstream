// The access token lives ONLY here, in a module-level variable — never in
// localStorage or sessionStorage (S-NFR-1.2). A JWT in Web Storage is
// readable by any script that runs on the page (e.g. through an XSS bug),
// while an in-memory variable disappears with the tab/reload, which is the
// point: a reload re-derives it from the httpOnly refresh cookie instead.
let accessToken = null;

// Plain subscriber list so privateClient's refresh interceptor and
// AuthProvider's status can react to a token change without either one
// importing the other.
const listeners = new Set();

export const tokenStore = {
  getToken: () => accessToken,

  setToken: (token) => {
    accessToken = token || null;
    listeners.forEach((listener) => listener(accessToken));
  },

  clearToken: () => {
    accessToken = null;
    listeners.forEach((listener) => listener(null));
  },

  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export default tokenStore;
