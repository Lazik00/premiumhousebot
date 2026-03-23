'use client';

import { useState } from 'react';
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

// const popularCities = [
//     { uz: 'Toshkent', emoji: '🏙️' },
//     { uz: 'Samarqand', emoji: '🕌' },
//     { uz: 'Buxoro', emoji: '🏰' },
//     { uz: 'Xiva', emoji: '🏛️' },
//     { uz: 'Farg\'ona', emoji: '🌄' },
//     { uz: 'Namangan', emoji: '🌸' },
//     { uz: 'Andijon', emoji: '🌿' },
//     { uz: 'Nukus', emoji: '🏜️' },
// ];

export default function SearchFilter({ onSearch, isLoading }: SearchFilterProps) {
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

    const handleCityClick = (cityName: string) => {
        haptic('light');
        setCity(cityName);
        onSearch({ city: cityName, guests });
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
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid var(--color-line)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 13,
        outline: 'none',
        fontFamily: 'var(--font-body)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        marginBottom: 6,
        display: 'block',
    };

    return (
        <div className="slide-up" style={{ marginBottom: 14 }}>
            {/* Search bar */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 10,
                }}
            >
                <div style={{ flex: 1, position: 'relative' }}>
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-muted)"
                        strokeWidth="2"
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Shahar yoki hudud qidiring..."
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        style={{
                            ...inputStyle,
                            paddingLeft: 38,
                        }}
                    />
                </div>
                <button
                    onClick={() => { setShowFilters(!showFilters); haptic('light'); }}
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        border: '1px solid var(--color-line)',
                        background: showFilters ? 'var(--color-brand)' : 'var(--color-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showFilters ? '#fff' : 'var(--color-muted)'} strokeWidth="2">
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

            {/* Quick city chips */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    paddingBottom: 4,
                    marginBottom: showFilters ? 12 : 0,
                }}
                className="hide-scrollbar"
            >
                {/*{popularCities.map((c) => (*/}
                {/*    <button*/}
                {/*        key={c.uz}*/}
                {/*        onClick={() => handleCityClick(c.uz)}*/}
                {/*        style={{*/}
                {/*            display: 'flex',*/}
                {/*            alignItems: 'center',*/}
                {/*            gap: 6,*/}
                {/*            padding: '7px 12px',*/}
                {/*            borderRadius: 20,*/}
                {/*            border: city === c.uz ? '1px solid var(--color-brand)' : '1px solid var(--color-line)',*/}
                {/*            background: city === c.uz ? 'rgba(108, 92, 231, 0.15)' : 'var(--color-surface)',*/}
                {/*            color: city === c.uz ? 'var(--color-brand-light)' : 'var(--color-text)',*/}
                {/*            fontSize: 12,*/}
                {/*            fontWeight: 500,*/}
                {/*            whiteSpace: 'nowrap',*/}
                {/*            cursor: 'pointer',*/}
                {/*            transition: 'all 0.2s ease',*/}
                {/*            fontFamily: 'var(--font-body)',*/}
                {/*        }}*/}
                {/*    >*/}
                {/*        <span>{c.emoji}</span>*/}
                {/*        <span>{c.uz}</span>*/}
                {/*    </button>*/}
                {/*))}*/}
            </div>

            {/* Expanded filters */}
            {showFilters && (
                <div
                    className="fade-in"
                    style={{
                        background: 'var(--color-surface)',
                        borderRadius: 14,
                        padding: 14,
                        border: '1px solid var(--color-line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}
                >
                    {/* Guests */}
                    <div>
                        <label style={labelStyle}>Mehmonlar soni</label>
                        <input
                            type="number"
                            min={1}
                            max={30}
                            placeholder="Mehmonlar"
                            value={guests ?? ''}
                            onChange={(e) => setGuests(e.target.value ? Number(e.target.value) : undefined)}
                            style={inputStyle}
                        />
                    </div>

                    {/* Dates */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Kirish sanasi</label>
                            <input
                                type="date"
                                value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Chiqish sanasi</label>
                            <input
                                type="date"
                                value={checkOut}
                                onChange={(e) => setCheckOut(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleReset}
                            style={{
                                flex: 1,
                                padding: '11px 14px',
                                borderRadius: 10,
                                border: '1px solid var(--color-line)',
                                background: 'transparent',
                                color: 'var(--color-muted)',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            Tozalash
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            style={{
                                flex: 2,
                                padding: '11px 14px',
                                borderRadius: 10,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.7 : 1,
                                fontFamily: 'var(--font-body)',
                                boxShadow: 'var(--shadow-glow)',
                            }}
                        >
                            {isLoading ? 'Qidirilmoqda...' : 'Qidirish'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
