// lib/auth/AuthContext.jsx — real auth against the Festify API.
//
// Google Identity Services issues an ID token in the browser, which we
// exchange at POST /auth/google for the app's own 7-day JWT. That JWT is
// kept in localStorage (see tokenStore) and sent as a bearer header by
// the axios client.
//
// The public interface here is deliberately identical to the mock version
// this replaces (isAuthenticated, isPrime, isMemberOf, login, logout, ...)
// so consuming components did not need to change.
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi } from '@/lib/api/endpoints';
import { tokenStore } from '@/lib/api/client';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** Load the Google Identity Services script once, resolving when ready. */
let gsiPromise = null;
function loadGsi() {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Start in a loading state only if there's a token worth validating,
  // so guests don't sit behind a spinner on first paint.
  const [isLoading, setIsLoading] = useState(() => !!tokenStore.get());
  const [authError, setAuthError] = useState(null);

  // Restore the session on mount from a stored token.
  //
  // The token is discarded only when the server actually rejects it.
  // Clearing on *any* failure meant a 502, a timeout or a dropped
  // connection destroyed a perfectly valid session -- so while the API
  // was down, every refresh silently signed the user out and there was
  // no way back in until it recovered.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;

    const restore = async (attempt = 0) => {
      try {
        const me = await authApi.me();
        if (!cancelled) { setUser(me); setIsLoading(false); }
      } catch (err) {
        const status = err?.response?.status;
        const rejected = status === 401 || status === 403;

        if (rejected) {
          tokenStore.clear();
          if (!cancelled) { setUser(null); setIsLoading(false); }
          return;
        }

        // Unreachable or erroring server. A cold start can take ~30s, so
        // give it two more tries before giving up -- and keep the token
        // either way, since nothing has said it is invalid.
        if (attempt < 2 && !cancelled) {
          setTimeout(() => restore(attempt + 1), (attempt + 1) * 2500);
          return;
        }
        if (!cancelled) {
          setAuthError('Could not reach the server. Your session is still saved — refresh once it is back.');
          setIsLoading(false);
        }
      }
    };

    restore();
    return () => { cancelled = true; };
  }, []);

  const completeLogin = useCallback(async (idToken) => {
    const { access_token, user: profile } = await authApi.google(idToken);
    tokenStore.set(access_token);
    setUser(profile);
    return profile;
  }, []);

  /**
   * Render Google's own sign-in button into `container`.
   *
   * This replaces an earlier attempt that called
   * google.accounts.id.prompt() (One Tap). Browsers suppress One Tap
   * routinely — third-party cookie blocking, a previous dismissal, or a
   * popup blocker all silence it — and the SDK reports that as
   * "dismissed", so sign-in appeared broken through no fault of the
   * user. The rendered button is a real user-gesture click and is not
   * subject to any of that.
   */
  const renderGoogleButton = useCallback((container, { onSuccess, onError } = {}) => {
    if (!container) return;
    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.');
      return;
    }
    setAuthError(null);

    loadGsi()
      .then((google) => {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (res) => {
            if (!res?.credential) {
              const msg = 'Google did not return a sign-in token. Please try again.';
              setAuthError(msg);
              onError?.(new Error(msg));
              return;
            }
            setIsLoading(true);
            try {
              const profile = await completeLogin(res.credential);
              onSuccess?.(profile);
            } catch (err) {
              const msg = err?.response?.data?.detail || err.message || 'Sign-in failed.';
              setAuthError(msg);
              onError?.(new Error(msg));
            } finally {
              setIsLoading(false);
            }
          },
        });
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        });
      })
      .catch((err) => {
        setAuthError(err.message);
        onError?.(err);
      });
  }, [completeLogin]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) return null;
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const orgMemberships = user?.org_memberships ?? [];

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    authError,
    isPrime: user?.is_prime ?? false,
    hasPrimePass: user?.has_prime_pass ?? false,
    isCollegeVerified: user?.is_college_verified ?? false,
    orgMemberships,
    isMemberOf: (orgId) => orgMemberships.some(m => m.org_id === orgId),
    isOwnerOf: (orgId) => orgMemberships.some(m => m.org_id === orgId && m.role === 'owner'),
    getOrgRole: (orgId) => orgMemberships.find(m => m.org_id === orgId)?.role ?? null,
    renderGoogleButton,
    completeLogin,
    logout,
    refreshUser,
    isGoogleConfigured: !!GOOGLE_CLIENT_ID,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// ── College admin / super admin ───────────────────────────────────
// The backend has no separate admin auth system yet (§4 describes super
// admin as separate, non-users-table auth that does not exist). Both
// admin surfaces authorise off the same user JWT: college admins via
// their college_admins row, super admins via the SUPER_ADMIN_EMAILS
// allowlist. These hooks therefore just read the main session rather
// than holding a second one.
const AdminAuthContext = createContext(null);

export function CollegeAdminAuthProvider({ children }) {
  return <AdminAuthContext.Provider value={{}}>{children}</AdminAuthContext.Provider>;
}
export const useCollegeAdminAuth = () => {
  const { user, isLoading, login, logout } = useAuth();
  return { admin: user, isAuthenticated: !!user, isLoading, login, logout };
};

export function SuperAdminAuthProvider({ children }) {
  return <AdminAuthContext.Provider value={{}}>{children}</AdminAuthContext.Provider>;
}
export const useSuperAdminAuth = () => {
  const { user, isLoading, login, logout } = useAuth();
  return { admin: user, isAuthenticated: !!user, isLoading, login, logout };
};
