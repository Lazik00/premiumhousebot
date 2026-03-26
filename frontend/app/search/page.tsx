'use client';

import { useState, useCallback } from 'react';
import { listProperties } from '../../lib/api';
import type { PropertySummary } from '../../lib/types';
import PropertyCard, { PropertyCardSkeleton } from '../../components/PropertyCard';
import SearchFilter, { type FilterValues } from '../../components/SearchFilter';
import BottomNav from '../../components/BottomNav';
import { useAppPreferences } from '../../context/AppPreferencesContext';

export default function SearchPage() {
    const { t } = useAppPreferences();
    const [properties, setProperties] = useState<PropertySummary[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const fetchProperties = useCallback(async (filters: FilterValues) => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            const res = await listProperties({ ...filters, limit: 30, offset: 0 });
            setProperties(res.items);
            setTotal(res.total);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSearch = (filters: FilterValues) => {
        fetchProperties(filters);
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            <div style={{ padding: 'calc(20px + var(--tg-safe-top, 60px)) 16px 0' }}>
                <div
                    style={{
                        padding: '18px 18px 16px',
                        borderRadius: 24,
                        background: 'var(--gradient-card)',
                        border: '1px solid var(--color-line)',
                        marginBottom: 16,
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <h1
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 32,
                            fontWeight: 700,
                            marginBottom: 6,
                        }}
                    >
                        {t('search.title')}
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                        {t('search.subtitle')}
                    </p>
                </div>

                <SearchFilter onSearch={handleSearch} isLoading={isLoading} />

                {hasSearched && !isLoading && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
                            {t('search.results')}
                        </h2>
                        <span style={{ fontSize: 13, color: 'var(--color-brand-light)', fontWeight: 800 }}>
                            {t('search.found', { count: total })}
                        </span>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, paddingBottom: 20 }}>
                    {isLoading ? (
                        <>
                            <PropertyCardSkeleton />
                            <PropertyCardSkeleton />
                        </>
                    ) : hasSearched ? (
                        properties.length > 0 ? (
                            properties.map((property, index) => (
                                <div key={property.id} className="slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                                    <PropertyCard property={property} />
                                </div>
                            ))
                        ) : (
                            <div className="fade-in" style={{ textAlign: 'center', padding: '54px 20px', color: 'var(--color-muted)', gridColumn: '1 / -1', borderRadius: 24, background: 'var(--gradient-card)', border: '1px solid var(--color-line)' }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                                    {t('search.noResultsTitle')}
                                </h3>
                                <p style={{ fontSize: 14 }}>
                                    {t('search.noResultsDescription')}
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="fade-in" style={{ textAlign: 'center', padding: '54px 20px', color: 'var(--color-muted)', gridColumn: '1 / -1', borderRadius: 24, background: 'var(--gradient-card)', border: '1px solid var(--color-line)' }}>
                            <div style={{ fontSize: 48, marginBottom: 12, animation: 'float 3s infinite' }}>🏡</div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                                {t('search.startTitle')}
                            </h3>
                            <p style={{ fontSize: 14 }}>
                                {t('search.startDescription')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
