
import { createContext, useState, useEffect } from "react";
import { fetchNewAccessToken } from "../api/auth";
import { registerAuthUpdater } from "../api/axios";

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
  const [loading, setLoading] = useState(true); // wait for refresh token check

  useEffect(() => {
    const rehydrate = async () => {
      try {
        const {accessToken,role} = await fetchNewAccessToken(); // 👈 call your function
        setAuth(authFromToken(accessToken, role));
      } catch (err) {
        console.log("No valid refresh token found.");
        setAuth({}); // empty auth
      } finally {
        setLoading(false);
      }
    };

    rehydrate();

    // Lets the axios interceptor push a silently-refreshed token back into
    // context (or clear auth entirely if the refresh itself fails).
    registerAuthUpdater((accessToken, role) => {
      setAuth(accessToken ? authFromToken(accessToken, role) : {});
    });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <AuthContext.Provider value={{ auth, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
