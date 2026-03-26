'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { getAppConfig } from '../lib/api';
import { resolveLanguage, translate, localeByLanguage } from '../lib/i18n';
import { getTelegramWebApp } from '../lib/telegram';
import type { AppConfigResponse, CurrencyCode, LanguageCode } from '../lib/types';

const LANGUAGE_STORAGE_KEY = 'ph_language';
const CURRENCY_STORAGE_KEY = 'ph_currency';

interface AppPreferencesState {
    language: LanguageCode;
    setLanguage: (language: LanguageCode) => void;
    currency: CurrencyCode;
    setCurrency: (currency: CurrencyCode) => void;
    locale: string;
    usdToUzsRate: number;
    config: AppConfigResponse | null;
    isConfigLoading: boolean;
    isHydrated: boolean;
    t: (key: string, variables?: Record<string, string | number>) => string;
}

const AppPreferencesContext = createContext<AppPreferencesState>({
    language: 'uz',
    setLanguage: () => undefined,
    currency: 'UZS',
    setCurrency: () => undefined,
    locale: localeByLanguage.uz,
    usdToUzsRate: 12500,
    config: null,
    isConfigLoading: true,
    isHydrated: false,
    t: (key) => key,
});

export function useAppPreferences() {
    return useContext(AppPreferencesContext);
}

function getInitialLanguage(): LanguageCode {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored === 'uz' || stored === 'ru' || stored === 'en') {
            return stored;
        }
    }

    const tgLanguage = getTelegramWebApp()?.initDataUnsafe.user?.language_code;
    return resolveLanguage(tgLanguage);
}

function getInitialCurrency(): CurrencyCode {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
        if (stored === 'UZS' || stored === 'USD') {
            return stored;
        }
    }
    return 'UZS';
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<LanguageCode>('uz');
    const [currency, setCurrencyState] = useState<CurrencyCode>('UZS');
    const [config, setConfig] = useState<AppConfigResponse | null>(null);
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setLanguageState(getInitialLanguage());
        setCurrencyState(getInitialCurrency());
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        }
    }, [language]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
        }
    }, [currency]);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const payload = await getAppConfig();
                setConfig(payload);
            } catch (error) {
                console.error('Failed to load public app config:', error);
            } finally {
                setIsConfigLoading(false);
            }
        };

        loadConfig();
    }, []);

    const setLanguage = useCallback((nextLanguage: LanguageCode) => {
        setLanguageState(nextLanguage);
    }, []);

    const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
        setCurrencyState(nextCurrency);
    }, []);

    const t = useCallback(
        (key: string, variables?: Record<string, string | number>) => translate(language, key, variables),
        [language],
    );

    const value = useMemo(
        () => ({
            language,
            setLanguage,
            currency,
            setCurrency,
            locale: localeByLanguage[language],
            usdToUzsRate: config?.exchange_rate.usd_to_uzs ?? 12500,
            config,
            isConfigLoading,
            isHydrated,
            t,
        }),
        [config, currency, isConfigLoading, isHydrated, language, setCurrency, setLanguage, t],
    );

    return (
        <AppPreferencesContext.Provider value={value}>
            {children}
        </AppPreferencesContext.Provider>
    );
}
