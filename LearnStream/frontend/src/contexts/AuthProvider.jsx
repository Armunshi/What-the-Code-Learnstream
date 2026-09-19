
import { createContext, useEffect, useState } from "react";
import { fetchNewAccessToken } from "../api/auth";
import { tokenStore } from "../lib/api/tokenStore";

const AuthContext = createContext({});

// Access tokens are short-lived JWTs signed by the backend with _id, name,
// email and role all as claims (backend/src/models/user.model.js's
// generateAccessToken) — decoding the payload client-side is enough to
// reconstruct the full `auth` shape from the token alone. This never
// verifies the signature, only the backend does that.
const authFromToken = (accessToken) => {
  const payload = JSON.parse(atob(accessToken.split('.')[1]));
  return { user_id: payload?._id, name: payload?.name, email: payload?.email, role: payload?.role, accessToken };
};

// tokenStore (lib/api/tokenStore.js) is the single source of truth for "is
// there a token right now" — every client (this file's boot-time rehydrate,
// api/axios.js's and lib/api/privateClient.js's own silent-refresh
// interceptors, and every login/signup success handler) commits a token by
// calling tokenStore.setToken()/clearToken() and nothing else. AuthProvider
// only *subscribes* to it and derives `auth`/`status` from whatever token is
// current, instead of each caller separately trying to keep three different
// pieces of state (tokenStore, this context's `auth`, this context's
// `status`) in sync by hand — which is exactly how a caller forgetting one
// of the three (as every pre-fix login path did) used to leave `status`
// stuck at 'guest' right after a real, successful login.
export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({});
  // 'unknown' while the refresh-token check is in flight, then either
  // 'authenticated' or 'guest'. Public pages read this instead of waiting
  // behind a blocking "Loading..." screen — the previous behavior, which
  // meant the whole app (including guest-facing pages) sat on a blank
  // screen until this resolved. The refresh logic itself is unchanged;
  // only the "block everything" part is gone.
  const [status, setStatus] = useState('unknown');

  useEffect(() => {
    const applyToken = (accessToken) => {
      if (accessToken) {
        setAuth(authFromToken(accessToken));
        setStatus('authenticated');
      } else {
        setAuth({});
        setStatus('guest');
      }
    };

    const unsubscribe = tokenStore.subscribe(applyToken);

    const rehydrate = async () => {
      try {
        const { accessToken } = await fetchNewAccessToken();
        tokenStore.setToken(accessToken);
      } catch {
        console.log("No valid refresh token found.");
        tokenStore.clearToken();
      }
    };

    rehydrate();

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ auth, status }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
