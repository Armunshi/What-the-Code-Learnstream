
import { createContext, useState, useEffect } from "react";
import { fetchNewAccessToken } from "../api/auth";
import { registerAuthUpdater } from "../api/axios";
import { tokenStore } from "../lib/api/tokenStore";

const AuthContext = createContext({});

// Access tokens are short-lived JWTs; decode the payload client-side just
// to read the non-sensitive user_id/name we already trust the server put
// there — this never verifies the signature, only the backend does that.
const authFromToken = (accessToken, role) => {
  const payload = JSON.parse(atob(accessToken.split('.')[1]));
  return { user_id: payload?._id, name: payload?.name, accessToken, role };
};

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
    const rehydrate = async () => {
      try {
        const {accessToken,role} = await fetchNewAccessToken(); // 👈 call your function
        setAuth(authFromToken(accessToken, role));
        tokenStore.setToken(accessToken);
        setStatus('authenticated');
      } catch {
        console.log("No valid refresh token found.");
        setAuth({}); // empty auth
        tokenStore.clearToken();
        setStatus('guest');
      }
    };

    rehydrate();

    // Lets the axios interceptor push a silently-refreshed token back into
    // context (or clear auth entirely if the refresh itself fails).
    registerAuthUpdater((accessToken, role) => {
      if (accessToken) {
        setAuth(authFromToken(accessToken, role));
        tokenStore.setToken(accessToken);
        setStatus('authenticated');
      } else {
        setAuth({});
        tokenStore.clearToken();
        setStatus('guest');
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, setAuth, status }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
