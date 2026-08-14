// lib/auth/AuthContext.jsx — Mock auth context (no backend)
import { createContext, useContext, useState, useCallback } from 'react';
import { mockUser } from '@/data/mockData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = guest, object = logged-in user
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(() => {
    setIsLoading(true);
    // Simulate OAuth delay
    setTimeout(() => {
      setUser(mockUser);
      setIsLoading(false);
    }, 800);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const isAuthenticated = !!user;
  const isPrime         = user?.is_prime ?? false;
  const hasPrimePass    = user?.has_prime_pass ?? false;
  const isCollegeVerified = user?.college_verified ?? false;
  const orgMemberships  = user?.org_memberships ?? [];

  const isMemberOf = (orgId) => orgMemberships.some(m => m.org_id === orgId);
  const isOwnerOf  = (orgId) => orgMemberships.some(m => m.org_id === orgId && m.role === 'owner');
  const getOrgRole = (orgId) => orgMemberships.find(m => m.org_id === orgId)?.role ?? null;

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoading,
      isPrime, hasPrimePass, isCollegeVerified, orgMemberships,
      isMemberOf, isOwnerOf, getOrgRole,
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// ── Separate mock college admin auth ──────────────────────────────
const CollegeAdminAuthContext = createContext(null);

export function CollegeAdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);

  const login = (credentials) => {
    // Mock login — accept any credentials
    setAdmin({ id: 'ca-1', name: 'College Admin', college_id: 'col-1', college_name: 'BITS Pilani' });
  };
  const logout = () => setAdmin(null);

  return (
    <CollegeAdminAuthContext.Provider value={{ admin, isAuthenticated: !!admin, login, logout }}>
      {children}
    </CollegeAdminAuthContext.Provider>
  );
}

export const useCollegeAdminAuth = () => {
  const ctx = useContext(CollegeAdminAuthContext);
  if (!ctx) throw new Error('useCollegeAdminAuth must be inside CollegeAdminAuthProvider');
  return ctx;
};

// ── Separate mock super admin auth ────────────────────────────────
const SuperAdminAuthContext = createContext(null);

export function SuperAdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);

  const login = () => setAdmin({ id: 'sa-1', name: 'Super Admin' });
  const logout = () => setAdmin(null);

  return (
    <SuperAdminAuthContext.Provider value={{ admin, isAuthenticated: !!admin, login, logout }}>
      {children}
    </SuperAdminAuthContext.Provider>
  );
}

export const useSuperAdminAuth = () => {
  const ctx = useContext(SuperAdminAuthContext);
  if (!ctx) throw new Error('useSuperAdminAuth must be inside SuperAdminAuthProvider');
  return ctx;
};
