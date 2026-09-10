import axios from 'axios';

// Create an Axios instance
const apiClient = axios.create({
    // baseURL: 'https://whathecode-learnstream.onrender.com',
    baseURL:  import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000', // Change this to your backend URL
    withCredentials: true, // Allows sending cookies
});

// AuthProvider registers itself here so the interceptor below can push a
// silently-refreshed token back into React context (and clear it on
// refresh failure) without axios.js importing anything React-specific.
let authUpdater = null;
export const registerAuthUpdater = (fn) => {
    authUpdater = fn;
};

const REFRESH_TOKEN_PATH = '/auth/refresh-Token';

// On a 401, try exactly one silent refresh + retry before giving up. This
// removes the need for every page to hand-roll its own 401 handling, and
// means a mid-session-expired access token doesn't strand the user on an
// "unauthorized" error.
apiClient.interceptors.response.use(
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
            const refreshResponse = await apiClient.post(REFRESH_TOKEN_PATH, {}, { withCredentials: true });
            const { accessToken, role } = refreshResponse.data.data;

            authUpdater?.(accessToken, role);

            originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${accessToken}`,
            };
            return apiClient(originalRequest);
        } catch (refreshError) {
            authUpdater?.(null);
            return Promise.reject(refreshError);
        }
    }
);

export default apiClient;

