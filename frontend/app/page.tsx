'use client';

import { useEffect, useState, useCallback } from 'react';
import { listProperties } from '../lib/api';
import type { PropertySummary } from '../lib/types';
import PropertyCard, { PropertyCardSkeleton } from '../components/PropertyCard';
import SearchFilter, { type FilterValues } from '../components/SearchFilter';
import BottomNav from '../components/BottomNav';

const propertyTypes = [
    { key: '', label: 'Barchasi', emoji: 'PH' },
    { key: 'apartment', label: 'Kvartira', emoji: 'APT' },
    { key: 'house', label: 'Uy', emoji: 'HSE' },
    { key: 'villa', label: 'Villa', emoji: 'VLA' },
];

const heroFallbacks = [
    'linear-gradient(135deg, rgba(215,176,107,0.24) 0%, rgba(34,24,14,0.1) 100%)',
    'linear-gradient(135deg, rgba(255,230,176,0.12) 0%, rgba(139,99,44,0.18) 100%)',
    'linear-gradient(135deg, rgba(200,157,84,0.2) 0%, rgba(17,12,8,0.08) 100%)',
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

    // const stats = [
    //     { label: 'Premium uylar', value: total || properties.length || 0 },
    //     { label: 'Shaharlar', value: new Set(properties.map((item) => item.city)).size || 1 },
    //     { label: 'Band qilish', value: '24/7' },
    // ];

    return (
        <div style={{ minHeight: '100vh' }}>
            <section
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 440,
                    padding: 'calc(34px + var(--tg-safe-top, 60px)) 16px 34px',
                    background: 'var(--gradient-hero)',
                    borderBottomLeftRadius: 32,
                    borderBottomRightRadius: 32,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: heroFallbacks[heroImageIndex % heroFallbacks.length],
                        opacity: 0.95,
                    }}
                />

                {heroImages.map((image, index) => (
                    <div
                        key={`${image}-${index}`}
                        className="hero-image-float"
                        style={{
                            position: 'absolute',
                            inset: '-5%',
                            background: `url(${image}) center/cover no-repeat`,
                            opacity: index === heroImageIndex ? 0.26 : 0,
                            transition: 'opacity 1.4s ease',
                            filter: 'saturate(0.86) contrast(0.94) brightness(0.7)',
                        }}
                    />
                ))}

                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(8,6,3,0.28) 0%, rgba(8,6,3,0.76) 48%, rgba(8,6,3,0.98) 100%)',
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 'calc(138px + var(--tg-safe-top, 60px))',
                        overflow: 'hidden',
                        opacity: 0.16,
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        className="brand-marquee"
                        style={{
                            display: 'flex',
                            width: 'max-content',
                            gap: 32,
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-display)',
                            fontSize: 56,
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'var(--color-brand-light)',
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

                <div style={{ position: 'relative', zIndex: 1, paddingTop: 42 }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 14px',
                            borderRadius: 999,
                            border: '1px solid rgba(242,217,162,0.18)',
                            background: 'rgba(20,16,12,0.5)',
                            color: 'var(--color-brand-light)',
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            marginBottom: 18,
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        <span>Luxury Telegram Booking</span>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-gold)' }} />
                    </div>

                    {/*<h1*/}
                    {/*    style={{*/}
                    {/*        maxWidth: 340,*/}
                    {/*        fontFamily: 'var(--font-display)',*/}
                    {/*        fontSize: 50,*/}
                    {/*        lineHeight: 0.94,*/}
                    {/*        fontWeight: 700,*/}
                    {/*        letterSpacing: '-0.04em',*/}
                    {/*        marginBottom: 12,*/}
                    {/*        color: '#fff7e8',*/}
                    {/*        textShadow: '0 10px 30px rgba(0,0,0,0.28)',*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    Premium uylarni*/}
                    {/*    <br />*/}
                    {/*    oltin uslubda*/}
                    {/*</h1>*/}
                    {/*<p*/}
                    {/*    style={{*/}
                    {/*        maxWidth: 332,*/}
                    {/*        fontSize: 14,*/}
                    {/*        lineHeight: 1.7,*/}
                    {/*        color: 'rgba(247,239,222,0.76)',*/}
                    {/*        marginBottom: 22,*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    Telegram ichida tez ishlaydigan, premium ko'rinishdagi ijara platformasi. Har qatorda 2 ta uy, silliq bron oqimi va chiroyli detail sahifalar.*/}
                    {/*</p>*/}

                    {/*<div*/}
                    {/*    style={{*/}
                    {/*        display: 'grid',*/}
                    {/*        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',*/}
                    {/*        gap: 10,*/}
                    {/*        maxWidth: 348,*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    {stats.map((item) => (*/}
                    {/*        <div*/}
                    {/*            key={item.label}*/}
                    {/*            style={{*/}
                    {/*                padding: '12px 10px',*/}
                    {/*                borderRadius: 18,*/}
                    {/*                background: 'rgba(20,16,12,0.68)',*/}
                    {/*                border: '1px solid rgba(242,217,162,0.14)',*/}
                    {/*                backdropFilter: 'blur(18px)',*/}
                    {/*                boxShadow: 'var(--shadow-sm)',*/}
                    {/*            }}*/}
                    {/*        >*/}
                    {/*            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff5df' }}>{item.value}</div>*/}
                    {/*            <div style={{ fontSize: 11, color: 'rgba(242,217,162,0.72)' }}>{item.label}</div>*/}
                    {/*        </div>*/}
                    {/*    ))}*/}
                    {/*</div>*/}
                </div>
            </section>

            <div style={{ padding: '16px 16px 0' }}>
                <SearchFilter onSearch={fetchProperties} isLoading={isLoading} />

                <div
                    className="hide-scrollbar"
                    style={{
                        display: 'flex',
                        gap: 8,
                        overflowX: 'auto',
                        marginBottom: 18,
                        paddingBottom: 2,
                    }}
                >
                    {propertyTypes.map((type) => (
                        <button
                            key={type.key}
                            onClick={() => setActiveType(type.key)}
                            style={{
                                border: activeType === type.key ? '1px solid rgba(242,217,162,0.28)' : '1px solid var(--color-line)',
                                background: activeType === type.key ? 'var(--gradient-brand)' : 'var(--color-surface)',
                                color: activeType === type.key ? 'var(--color-ink-soft)' : 'var(--color-text)',
                                borderRadius: 999,
                                padding: '9px 16px',
                                fontSize: 12,
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                                boxShadow: activeType === type.key ? 'var(--shadow-glow)' : 'none',
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
                        marginBottom: 14,
                    }}
                >
                    <div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>
                            Tavsiya etilgan uylar
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                            Premium House katalogi, har qatorda 2 ta uy
                        </p>
                    </div>
                    {!isLoading && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-brand-light)' }}>
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
                                padding: '52px 18px',
                                borderRadius: 24,
                                textAlign: 'center',
                                background: 'var(--gradient-card)',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-muted)',
                            }}
                        >
                            <div style={{ fontSize: 40, marginBottom: 10 }}>No homes</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text)' }}>
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
