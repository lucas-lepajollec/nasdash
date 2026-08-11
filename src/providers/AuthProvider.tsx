'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthContextType {
  user: AuthUser | null;
  authLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface AuthUser {
  username: string;
  role: 'admin' | 'viewer';
  allowedTabs?: string[];
  allowedWidgets?: string[];
  isAnonymous?: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json() as { user: AuthUser | null };
      setUser(data.user);
    } catch (e) {
      console.error('Erreur vérification session:', e);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      // A full reload intentionally clears every in-memory auth and SSE state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    } catch (e) {
      console.error('Erreur déconnexion:', e);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    }
  };

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        alert("Accès refusé. Session administrateur requise.");
        // A full reload prevents protected provider state surviving the redirect.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        throw new Error('Unauthorized');
      }
      return res;
    } catch (err) {
      console.error('Erreur Fetch sécurisé:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, authLoading, logout, refreshUser, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
