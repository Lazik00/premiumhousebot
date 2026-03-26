'use client';

import { useAppPreferences } from '../context/AppPreferencesContext';
import { formatMoney } from '../lib/price';
import type { CurrencyCode, LanguageCode } from '../lib/types';

const languageOptions: Array<{ code: LanguageCode; label: string }> = [
    { code: 'uz', label: 'UZ' },
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
];

const currencyOptions: Array<{ code: CurrencyCode; label: string }> = [
    { code: 'UZS', label: 'UZS' },
    { code: 'USD', label: 'USD' },
];

function segmentedButtonStyle(active: boolean): React.CSSProperties {
    return {
        flex: 1,
        padding: '7px 0',
        borderRadius: 12,
        border: 'none',
        background: active ? 'linear-gradient(135deg, #f2d9a2 0%, #c89c55 100%)' : 'transparent',
        color: active ? '#130d08' : 'rgba(255,247,232,0.74)',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.08em',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    };
}

export default function PreferenceDock() {
    const {
        language,
        setLanguage,
        currency,
        setCurrency,
        usdToUzsRate,
        isHydrated,
        t,
    } = useAppPreferences();

    const exchangeRateLabel = isHydrated ? formatMoney(usdToUzsRate, 'UZS', language) : '...';

    return (
        <div
            style={{
                marginLeft: 'auto',
                width: 'min(100%, 172px)',
                padding: 10,
                borderRadius: 20,
                background: 'linear-gradient(180deg, rgba(12,9,6,0.82) 0%, rgba(12,9,6,0.68) 100%)',
                border: '1px solid rgba(242,217,162,0.16)',
                boxShadow: '0 18px 34px rgba(0,0,0,0.24)',
                backdropFilter: 'blur(18px)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--color-brand-light)', letterSpacing: '0.12em', fontWeight: 800, textTransform: 'uppercase' }}>
                    {t('language.label')}
                </span>
            </div>
            <div
                style={{
                    display: 'flex',
                    gap: 4,
                    padding: 4,
                    borderRadius: 16,
                    background: 'rgba(255,247,232,0.04)',
                    border: '1px solid rgba(242,217,162,0.08)',
                    marginBottom: 10,
                }}
            >
                {languageOptions.map((option) => (
                    <button
                        key={option.code}
                        type="button"
                        onClick={() => setLanguage(option.code)}
                        style={segmentedButtonStyle(option.code === language)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--color-brand-light)', letterSpacing: '0.12em', fontWeight: 800, textTransform: 'uppercase' }}>
                    {t('profile.currency')}
                </span>
            </div>
            <div
                style={{
                    display: 'flex',
                    gap: 4,
                    padding: 4,
                    borderRadius: 16,
                    background: 'rgba(255,247,232,0.04)',
                    border: '1px solid rgba(242,217,162,0.08)',
                    marginBottom: 10,
                }}
            >
                {currencyOptions.map((option) => (
                    <button
                        key={option.code}
                        type="button"
                        onClick={() => setCurrency(option.code)}
                        style={segmentedButtonStyle(option.code === currency)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div
                style={{
                    padding: '8px 10px',
                    borderRadius: 14,
                    background: 'rgba(255,247,232,0.04)',
                    border: '1px solid rgba(242,217,162,0.08)',
                    fontSize: 11,
                    color: 'rgba(255,247,232,0.76)',
                    lineHeight: 1.45,
                }}
            >
                {t('home.preferenceRate', { rate: exchangeRateLabel })}
            </div>
        </div>
    );
}
