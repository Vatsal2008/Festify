// lib/api/client.js — Axios instance with bearer-token auth.
//
// The backend issues a plain 7-day JWT and has no refresh endpoint, so
// there is no refresh/retry cycle here. On a 401 the token is simply
// cleared and the user is sent to /login. (An earlier version of this
// file attempted POST /auth/refresh against an httpOnly cookie; no such
// endpoint exists, so that path could only ever have failed.)
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_KEY = 'festify_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // A cold Render instance takes ~30s to wake on its own. When email is
  // relayed through a tunnel, a send adds the round trip to that machine
  // and Gmail's handshake on top, so 30s aborted requests that were
  // still working -- and an aborted request reports as a network failure,
  // which the browser then blames on CORS.
  timeout: 75000,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      // Only redirect if we're on a page that actually required auth —
      // public pages send an optional token and must not bounce guests.
      const path = window.location.pathname;
      // Super admins sign in at /super, not through Google, so an
      // expired admin session must go back to its own door. Sending it
      // to /login would offer a Google button that cannot grant admin
      // access, which reads as the panel being broken.
      if (/^\/super/.test(path)) {
        window.location.href = '/super';
        return Promise.reject(error);
      }
      // These prefixes changed when the admin URLs were split; the old
      // names matched nothing, so a 401 on an admin page silently did
      // nothing at all.
      if (/^\/(me|org|admin)/.test(path)) {
        sessionStorage.setItem('festify_return_url', path);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from a FastAPI error response. */
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please retry.';
  if (!err?.response) return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export default apiClient;
