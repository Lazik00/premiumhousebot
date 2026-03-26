'use client';

import { useState } from 'react';
import { useAppPreferences } from '../context/AppPreferencesContext';
import { haptic } from '../lib/telegram';

interface SearchFilterProps {
    onSearch: (filters: FilterValues) => void;
    isLoading?: boolean;
}

export interface FilterValues {
    city?: string;
    guests?: number;
    check_in?: string;
    check_out?: string;
}

export default function SearchFilter({ onSearch, isLoading }: SearchFilterProps) {
    const { t } = useAppPreferences();
    const [city, setCity] = useState('');
    const [guests, setGuests] = useState<number | undefined>();
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const handleSearch = () => {
        haptic('medium');
        onSearch({
            city: city || undefined,
            guests,
            check_in: checkIn || undefined,
            check_out: checkOut || undefined,
        });
    };

    const handleReset = () => {
        haptic('light');
        setCity('');
        setGuests(undefined);
        setCheckIn('');
        setCheckOut('');
        onSearch({});
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid var(--color-line)',
        background: 'rgba(255,255,255,0.02)',
        color: 'var(--color-text)',
        fontSize: 13,
        outline: 'none',
        fontFamily: 'var(--font-body)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-brand-light)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 6,
        display: 'block',
    };

    return (
        <div className="slide-up" style={{ marginBottom: 16 }}>
            <div
                style={{
                    padding: 12,
                    borderRadius: 22,
                    background: 'linear-gradient(180deg, rgba(20,16,12,0.9) 0%, rgba(20,16,12,0.78) 100%)',
                    border: '1px solid var(--color-line)',
                    boxShadow: 'var(--shadow-md)',
                    marginBottom: 10,
                }}
            >
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--color-brand-light)"
                            strokeWidth="2"
                            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.9 }}
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder={t('search.placeholder')}
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            style={{
                                ...inputStyle,
                                paddingLeft: 42,
                                background: 'rgba(255,255,255,0.03)',
                            }}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setShowFilters(!showFilters);
                            haptic('light');
                        }}
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 14,
                            border: showFilters ? 'none' : '1px solid var(--color-line)',
                            background: showFilters ? 'var(--gradient-brand)' : 'rgba(255,255,255,0.03)',
                            color: showFilters ? 'var(--color-ink-soft)' : 'var(--color-brand-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            boxShadow: showFilters ? 'var(--shadow-glow)' : 'none',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="4" y1="21" x2="4" y2="14" />
                            <line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" />
                            <line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" />
                            <line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                    </button>
                </div>
            </div>

            {showFilters && (
                <div
                    className="fade-in"
                    style={{
                        background: 'var(--gradient-card)',
                        borderRadius: 20,
                        padding: 16,
                        border: '1px solid var(--color-line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div>
                        <label style={labelStyle}>{t('search.guests')}</label>
                        <input
                            type="number"
                            min={1}
                            max={30}
                            placeholder={t('search.guestsPlaceholder')}
                            value={guests ?? ''}
                            onChange={(e) => setGuests(e.target.value ? Number(e.target.value) : undefined)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>{t('search.checkIn')}</label>
                            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>{t('search.checkOut')}</label>
                            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleReset}
                            style={{
                                flex: 1,
                                padding: '12px 14px',
                                borderRadius: 14,
                                border: '1px solid var(--color-line)',
                                background: 'rgba(255,255,255,0.02)',
                                color: 'var(--color-muted)',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {t('search.clear')}
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            style={{
                                flex: 2,
                                padding: '12px 14px',
                                borderRadius: 14,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: 'var(--color-ink-soft)',
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.7 : 1,
                                fontFamily: 'var(--font-body)',
                                boxShadow: 'var(--shadow-glow)',
                            }}
                        >
                            {isLoading ? t('search.searching') : t('search.submit')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
