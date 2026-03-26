'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminLogin, clearTokens, getAccessToken, getMe, hasRefreshToken, loadTokens, logout as apiLogout, refreshStoredSession } from '../lib/api';
import type { UserMe } from '../lib/types';

interface AdminAuthContextValue {
  user: UserMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => undefined,
  logout: async () => undefined,
  refreshProfile: async () => undefined,
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const me = await getMe();
    if (!me.roles.some((role) => role === 'admin' || role === 'super_admin')) {
      clearTokens();
      throw new Error('Admin access required');
    }
    setUser(me);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await adminLogin(email, password);
    const profile = await getMe();
    setUser({ ...profile, roles: response.user.roles.length ? response.user.roles : profile.roles });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  useEffect(() => {
    loadTokens();
    const boot = async () => {
      if (!getAccessToken() && !hasRefreshToken()) {
        setIsLoading(false);
        return;
      }
      try {
        if (hasRefreshToken()) {
          await refreshStoredSession();
        }
        await refreshProfile();
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void boot();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshProfile,
    }),
    [isLoading, login, logout, refreshProfile, user],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
