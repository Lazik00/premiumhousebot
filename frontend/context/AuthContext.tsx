'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { loginWithTelegram, getMe, logout as apiLogout, loadTokens, getAccessToken, clearTokens } from '@/lib/api';
import { getInitData, initTelegramApp } from '@/lib/telegram';
import type { AuthUser, UserMe } from '@/lib/types';

interface AuthState {
    user: (AuthUser & Partial<UserMe>) | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    login: async () => { },
    logout: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<(AuthUser & Partial<UserMe>) | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const login = useCallback(async () => {
        try {
            const initData = getInitData();
            if (initData) {
                const res = await loginWithTelegram(initData);
                setUser(res.user);
            }
        } catch (err) {
            console.error('Telegram login failed:', err);
        }
    }, []);

    const logout = useCallback(async () => {
        await apiLogout();
        setUser(null);
    }, []);

    useEffect(() => {
        initTelegramApp();
        loadTokens();

        const boot = async () => {
            try {
                if (getAccessToken()) {
                    const me = await getMe();
                    setUser(me);
                } else {
                    await login();
                }
            } catch {
                await login().catch(() => { });
            } finally {
                setIsLoading(false);
            }
        };

        boot();
    }, [login]);

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
