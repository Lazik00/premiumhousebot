'use client';

import { useEffect, useRef, useState } from 'react';
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
        padding: '9px 0',
        borderRadius: 11,
        border: active ? '1px solid rgba(242,217,162,0.24)' : '1px solid transparent',
        background: active ? 'linear-gradient(135deg, rgba(242,217,162,0.96) 0%, rgba(200,156,85,0.98) 100%)' : 'rgba(255,247,232,0.03)',
        color: active ? '#130d08' : 'rgba(255,247,232,0.8)',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
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
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const exchangeRateLabel = isHydrated ? formatMoney(usdToUzsRate, 'UZS', language) : '...';
    const currentLanguageLabel = languageOptions.find((option) => option.code === language)?.label ?? 'UZ';

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (!rootRef.current) return;
            if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown, { passive: true });
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    return (
        <div
            ref={rootRef}
            style={{
                marginLeft: 'auto',
                position: 'relative',
                width: 'fit-content',
            }}
        >
            <button
                type="button"
                aria-expanded={isOpen}
                aria-label={`${t('language.label')} / ${t('profile.currency')}`}
                onClick={() => setIsOpen((value) => !value)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 88,
                    padding: '9px 11px',
                    borderRadius: 18,
                    border: isOpen ? '1px solid rgba(242,217,162,0.26)' : '1px solid rgba(242,217,162,0.14)',
                    background: isOpen
                        ? 'linear-gradient(180deg, rgba(14,11,8,0.9) 0%, rgba(14,11,8,0.78) 100%)'
                        : 'linear-gradient(180deg, rgba(14,11,8,0.72) 0%, rgba(14,11,8,0.58) 100%)',
                    boxShadow: isOpen ? '0 18px 34px rgba(0,0,0,0.3)' : '0 10px 22px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
            >
                <div
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: 'linear-gradient(135deg, rgba(242,217,162,0.22) 0%, rgba(200,156,85,0.24) 100%)',
                        border: '1px solid rgba(242,217,162,0.18)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2Z" stroke="#F2D9A2" strokeWidth="1.5" />
                        <path d="M2.5 12H21.5M12 2C14.4 4.4 15.765 8.089 15.765 12C15.765 15.911 14.4 19.6 12 22M12 2C9.6 4.4 8.235 8.089 8.235 12C8.235 15.911 9.6 19.6 12 22" stroke="#F2D9A2" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                    <span style={{ fontSize: 10, lineHeight: 1, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--color-brand-light)' }}>
                        {currentLanguageLabel}
                    </span>
                    <span style={{ fontSize: 10, lineHeight: 1.1, fontWeight: 700, color: 'rgba(255,247,232,0.72)' }}>
                        {currency}
                    </span>
                </div>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    style={{
                        marginLeft: 2,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                    }}
                >
                    <path d="M6 9L12 15L18 9" stroke="rgba(255,247,232,0.72)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className="scale-in"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: 164,
                        padding: 10,
                        borderRadius: 18,
                        background: 'linear-gradient(180deg, rgba(12,9,6,0.96) 0%, rgba(12,9,6,0.9) 100%)',
                        border: '1px solid rgba(242,217,162,0.14)',
                        boxShadow: '0 20px 42px rgba(0,0,0,0.36)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        zIndex: 20,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--color-brand-light)', letterSpacing: '0.14em', fontWeight: 800, textTransform: 'uppercase' }}>
                            {t('language.label')}
                        </span>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 4,
                            padding: 3,
                            borderRadius: 14,
                            background: 'rgba(255,247,232,0.035)',
                            border: '1px solid rgba(242,217,162,0.08)',
                            marginBottom: 8,
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--color-brand-light)', letterSpacing: '0.14em', fontWeight: 800, textTransform: 'uppercase' }}>
                            {t('profile.currency')}
                        </span>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 4,
                            padding: 3,
                            borderRadius: 14,
                            background: 'rgba(255,247,232,0.035)',
                            border: '1px solid rgba(242,217,162,0.08)',
                            marginBottom: 8,
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
                            padding: '7px 9px',
                            borderRadius: 12,
                            background: 'rgba(255,247,232,0.035)',
                            border: '1px solid rgba(242,217,162,0.07)',
                            fontSize: 10,
                            color: 'rgba(255,247,232,0.68)',
                            lineHeight: 1.35,
                        }}
                    >
                        {t('home.preferenceRate', { rate: exchangeRateLabel })}
                    </div>
                </div>
            )}
        </div>
    );
}
