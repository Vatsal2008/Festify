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
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    authApi.me()
      .then((me) => { if (!cancelled) setUser(me); })
      .catch(() => { tokenStore.clear(); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const completeLogin = useCallback(async (idToken) => {
    const { access_token, user: profile } = await authApi.google(idToken);
    tokenStore.set(access_token);
    setUser(profile);
    return profile;
  }, []);

  const login = useCallback(async () => {
    setAuthError(null);
    if (!GOOGLE_CLIENT_ID) {
      const msg = 'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.';
      setAuthError(msg);
      throw new Error(msg);
    }
    setIsLoading(true);
    try {
      const google = await loadGsi();
      const idToken = await new Promise((resolve, reject) => {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => res?.credential
            ? resolve(res.credential)
            : reject(new Error('Google sign-in was cancelled.')),
        });
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            reject(new Error('Google sign-in was dismissed. Allow popups and try again.'));
          }
        });
      });
      return await completeLogin(idToken);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
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
    login,
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
