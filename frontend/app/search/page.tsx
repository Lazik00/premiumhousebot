'use client';

import { useEffect, useState, useCallback } from 'react';
import { listProperties } from '../../lib/api';
import type { PropertySummary } from '../../lib/types';
import PropertyCard, { PropertyCardSkeleton } from '../../components/PropertyCard';
import SearchFilter, { type FilterValues } from '../../components/SearchFilter';
import BottomNav from '../../components/BottomNav';

export default function SearchPage() {
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
            {/* Header */}
            <div style={{ padding: 'calc(20px + var(--tg-safe-top, 60px)) 16px 0' }}>
                <h1
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 26,
                        fontWeight: 800,
                        marginBottom: 4,
                    }}
                >
                    🔍 Qidiruv
                </h1>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 16 }}>
                    Shahar, sana va mehmonlar soni bo&apos;yicha uylarni toping
                </p>

                <SearchFilter onSearch={handleSearch} isLoading={isLoading} />

                {/* Results */}
                {hasSearched && !isLoading && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
                            Natijalar
                        </h2>
                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                            {total} ta topildi
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
                                <div
                                    key={property.id}
                                    className="slide-up"
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <PropertyCard property={property} />
                                </div>
                            ))
                        ) : (
                            <div className="fade-in" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-muted)', gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                                    Natija topilmadi
                                </h3>
                                <p style={{ fontSize: 14 }}>
                                    Boshqa filterlarni sinab ko&apos;ring
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="fade-in" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-muted)', gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 48, marginBottom: 12, animation: 'float 3s infinite' }}>🏡</div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                                Qidiruvni boshlang
                            </h3>
                            <p style={{ fontSize: 14 }}>
                                Shahar tanlang yoki filterlarni sozlang
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
