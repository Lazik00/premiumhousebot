'use client';

import { useEffect, useState, useCallback } from 'react';
import { listProperties } from '@/lib/api';
import type { PropertySummary } from '@/lib/types';
import PropertyCard, { PropertyCardSkeleton } from '@/components/PropertyCard';
import SearchFilter, { type FilterValues } from '@/components/SearchFilter';
import BottomNav from '@/components/BottomNav';

const propertyTypes = [
    { key: '', label: 'Barchasi', emoji: 'All' },
    { key: 'apartment', label: 'Kvartira', emoji: 'Apt' },
    { key: 'house', label: 'Uy', emoji: 'Home' },
    { key: 'villa', label: 'Villa', emoji: 'Villa' },
];

const heroFallbacks = [
    'linear-gradient(135deg, rgba(205, 223, 255, 0.22) 0%, rgba(0, 112, 243, 0.1) 100%)',
    'linear-gradient(135deg, rgba(255, 214, 170, 0.2) 0%, rgba(255, 120, 80, 0.08) 100%)',
    'linear-gradient(135deg, rgba(202, 255, 214, 0.18) 0%, rgba(32, 191, 107, 0.08) 100%)',
];

export default function HomePage() {
    const [properties, setProperties] = useState<PropertySummary[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [activeType, setActiveType] = useState('');
    const [heroImageIndex, setHeroImageIndex] = useState(0);

    const fetchProperties = useCallback(async (filters: FilterValues = {}) => {
        setIsLoading(true);
        try {
            const res = await listProperties({ ...filters, limit: 20, offset: 0 });
            setProperties(res.items);
            setTotal(res.total);
        } catch (err) {
            console.error('Failed to fetch properties:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProperties();
    }, [fetchProperties]);

    const heroImages = properties
        .slice(0, 6)
        .map((item) => item.cover_image)
        .filter(Boolean) as string[];

    useEffect(() => {
        if (heroImages.length <= 1) return;
        const interval = setInterval(() => {
            setHeroImageIndex((prev) => (prev + 1) % heroImages.length);
        }, 3600);
        return () => clearInterval(interval);
    }, [heroImages.length]);

    const filteredProperties = activeType
        ? properties.filter((property) => property.property_type === activeType)
        : properties;

    return (
        <div style={{ minHeight: '100vh' }}>
            <section
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 352,
                    padding: 'calc(36px + var(--tg-safe-top, 60px)) 16px 30px',
                    background: 'linear-gradient(180deg, #11141c 0%, #131926 48%, var(--color-canvas) 100%)',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: heroFallbacks[heroImageIndex % heroFallbacks.length],
                        opacity: 0.85,
                    }}
                />

                {heroImages.map((image, index) => (
                    <div
                        key={`${image}-${index}`}
                        className="hero-image-float"
                        style={{
                            position: 'absolute',
                            inset: '-4%',
                            background: `url(${image}) center/cover no-repeat`,
                            opacity: index === heroImageIndex ? 0.2 : 0,
                            transition: 'opacity 1.4s ease',
                            filter: 'saturate(0.9) contrast(0.95)',
                        }}
                    />
                ))}

                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(10,12,18,0.52) 0%, rgba(10,12,18,0.74) 45%, rgba(10,12,18,0.96) 100%)',
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 'calc(98px + var(--tg-safe-top, 60px))',
                        overflow: 'hidden',
                        opacity: 0.2,
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        className="brand-marquee"
                        style={{
                            display: 'flex',
                            width: 'max-content',
                            gap: 28,
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-display)',
                            fontSize: 42,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: '#fff',
                        }}
                    >
                        <span>Premium House</span>
                        <span>Premium House</span>
                        <span>Premium House</span>
                        <span>Premium House</span>
                        <span>Premium House</span>
                        <span>Premium House</span>
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 1, paddingTop: 54 }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.78)',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: 16,
                        }}
                    >
                        <span>Premium House</span>
                        <span style={{ width: 6, height: 6, alignItems:"end" , borderRadius: '50%', background: '#7ef3cb' }} />
                    </div>

                    {/*<h1*/}
                    {/*    style={{*/}
                    {/*        maxWidth: 320,*/}
                    {/*        fontFamily: 'var(--font-display)',*/}
                    {/*        fontSize: 38,*/}
                    {/*        lineHeight: 1.02,*/}
                    {/*        fontWeight: 800,*/}
                    {/*        letterSpacing: '-0.03em',*/}
                    {/*        marginBottom: 12,*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    Toshkentdan*/}
                    {/*    <br />*/}
                    {/*    Buxorogacha*/}
                    {/*</h1>*/}
                    {/*<p*/}
                    {/*    style={{*/}
                    {/*        maxWidth: 320,*/}
                    {/*        fontSize: 14,*/}
                    {/*        lineHeight: 1.6,*/}
                    {/*        color: 'rgba(255,255,255,0.72)',*/}
                    {/*        marginBottom: 24,*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    Kunlik va oylik premium uylarni tez toping. Rasmlar banner ortida almashadi, kartalar esa ikki qatorda chiqadi.*/}
                    {/*</p>*/}

                    {/*<div*/}
                    {/*    style={{*/}
                    {/*        display: 'grid',*/}
                    {/*        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',*/}
                    {/*        gap: 10,*/}
                    {/*        maxWidth: 332,*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    {[*/}
                    {/*        { label: 'Uylar', value: total || properties.length || 0 },*/}
                    {/*        { label: 'Shaharlar', value: new Set(properties.map((item) => item.city)).size || 4 },*/}
                    {/*        { label: 'Top villa', value: '24/7' },*/}
                    {/*    ].map((item) => (*/}
                    {/*        <div*/}
                    {/*            key={item.label}*/}
                    {/*            style={{*/}
                    {/*                padding: '12px 10px',*/}
                    {/*                borderRadius: 16,*/}
                    {/*                background: 'rgba(255,255,255,0.07)',*/}
                    {/*                border: '1px solid rgba(255,255,255,0.08)',*/}
                    {/*                backdropFilter: 'blur(14px)',*/}
                    {/*            }}*/}
                    {/*        >*/}
                    {/*            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{item.value}</div>*/}
                    {/*            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{item.label}</div>*/}
                    {/*        </div>*/}
                    {/*    ))}*/}
                    {/*</div>*/}
                </div>
            </section>

            <div style={{ padding: '14px 16px 0' }}>
                <SearchFilter onSearch={fetchProperties} isLoading={isLoading} />

                <div
                    className="hide-scrollbar"
                    style={{
                        display: 'flex',
                        gap: 8,
                        overflowX: 'auto',
                        marginBottom: 16,
                        paddingBottom: 2,
                    }}
                >
                    {propertyTypes.map((type) => (
                        <button
                            key={type.key}
                            onClick={() => setActiveType(type.key)}
                            style={{
                                border: activeType === type.key ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--color-line)',
                                background: activeType === type.key ? '#f7f3ea' : 'var(--color-surface)',
                                color: activeType === type.key ? '#11141c' : 'var(--color-text)',
                                borderRadius: 999,
                                padding: '8px 14px',
                                fontSize: 12,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {type.emoji} {type.label}
                        </button>
                    ))}
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                    }}
                >
                    <div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>
                            Tavsiya etilgan uylar
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                            Har qatorda 2 ta uy ko&apos;rinadi
                        </p>
                    </div>
                    {!isLoading && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)' }}>
                            {filteredProperties.length} ta
                        </span>
                    )}
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 12,
                        paddingBottom: 36,
                    }}
                >
                    {isLoading ? (
                        <>
                            <PropertyCardSkeleton />
                            <PropertyCardSkeleton />
                            <PropertyCardSkeleton />
                            <PropertyCardSkeleton />
                        </>
                    ) : filteredProperties.length > 0 ? (
                        filteredProperties.map((property, index) => (
                            <div key={property.id} className="slide-up" style={{ animationDelay: `${index * 0.04}s` }}>
                                <PropertyCard property={property} />
                            </div>
                        ))
                    ) : (
                        <div
                            style={{
                                gridColumn: '1 / -1',
                                padding: '50px 18px',
                                borderRadius: 20,
                                textAlign: 'center',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-muted)',
                            }}
                        >
                            <div style={{ fontSize: 40, marginBottom: 10 }}>No homes</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text)' }}>
                                Mos uy topilmadi
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
