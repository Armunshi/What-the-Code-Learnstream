import axios from 'axios';
import { tokenStore } from './tokenStore';

// privateClient is for anything that needs the logged-in user's identity
// (cart, enrollment, authoring, account). It always sends the refresh
// cookie (withCredentials) and attaches the in-memory access token, and it
// is the only client allowed to trigger a token refresh.
export const privateClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
  withCredentials: true,
});

const REFRESH_TOKEN_PATH = '/auth/refresh-Token';

privateClient.interceptors.request.use((config) => {
  const token = tokenStore.getToken();
  if (token) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }
  return config;
});

// Concurrent 401s (e.g. five widgets all fetching on mount with a just-
// expired token) must not each fire their own refresh request — that would
// race the backend's refresh-token rotation and strand all but one caller
// with an already-invalidated token. Every 401 handler awaits the SAME
// in-flight promise; only the first one actually calls the endpoint.
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = privateClient
      .post(REFRESH_TOKEN_PATH, {}, { withCredentials: true })
      .then((response) => {
        const { accessToken } = response.data?.data || {};
        tokenStore.setToken(accessToken || null);
        return accessToken;
      })
      .catch((error) => {
        tokenStore.clearToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

privateClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      originalRequest?.url?.includes(REFRESH_TOKEN_PATH)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${accessToken}`,
      };
      return privateClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default privateClient;
