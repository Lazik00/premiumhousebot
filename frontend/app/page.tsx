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
    'linear-gradient(135deg, rgba(255,230,176,0.14) 0%, rgba(139,99,44,0.18) 100%)',
    'linear-gradient(135deg, rgba(200,157,84,0.22) 0%, rgba(17,12,8,0.08) 100%)',
];

function formatPrice(price: number, currency: string): string {
    if (currency === 'UZS') {
        return `${new Intl.NumberFormat('uz-UZ').format(price)} so'm`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

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

    const heroProperties = properties.slice(0, 5);
    const heroImages = heroProperties.map((item) => item.cover_image).filter(Boolean) as string[];
    const heroCount = heroProperties.length;
    const safeHeroIndex = heroCount > 0 ? heroImageIndex % heroCount : 0;
    const currentHero = heroCount > 0 ? heroProperties[safeHeroIndex] : null;
    const previousHero = heroCount > 1 ? heroProperties[(safeHeroIndex - 1 + heroCount) % heroCount] : null;
    const nextHero = heroCount > 1 ? heroProperties[(safeHeroIndex + 1) % heroCount] : null;

    useEffect(() => {
        if (heroCount <= 1) return;
        const interval = setInterval(() => {
            setHeroImageIndex((prev) => (prev + 1) % heroCount);
        }, 3200);
        return () => clearInterval(interval);
    }, [heroCount]);

    const filteredProperties = activeType
        ? properties.filter((property) => property.property_type === activeType)
        : properties;

    const cityCount = new Set(properties.map((item) => item.city)).size || 1;
    const featureTiles = [
        {
            icon: '/brand/icon-location-gold.svg',
            title: 'Aniq lokatsiya',
            description: 'Har bir uy detailida xarita bilan ko\'rsatiladi.',
        },
        {
            icon: '/brand/icon-people-gold.svg',
            title: 'Mos sig\'im',
            description: 'Mehmon soni va tarkibi bron oldidan aniq bilinadi.',
        },
        {
            icon: '/brand/icon-chat-gold.svg',
            title: 'Telegram ichida',
            description: 'To\'lov, aloqa va buyurtma oqimi Mini App ichida ishlaydi.',
        },
    ];

    return (
        <div style={{ minHeight: '100vh' }}>
            <section
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 560,
                    padding: 'calc(18px + var(--tg-safe-top, 60px)) 16px 112px',
                    background: 'var(--gradient-hero)',
                    borderBottomLeftRadius: 34,
                    borderBottomRightRadius: 34,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'repeating-radial-gradient(circle at 16% 18%, rgba(210,174,104,0.07) 0 22px, transparent 22px 48px)',
                        opacity: 0.9,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: heroFallbacks[safeHeroIndex % heroFallbacks.length],
                        opacity: 0.92,
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
                            opacity: index === safeHeroIndex ? 0.26 : 0,
                            transition: 'opacity 1.2s ease',
                            filter: 'saturate(0.88) contrast(0.96) brightness(0.68)',
                        }}
                    />
                ))}

                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(8,6,3,0.24) 0%, rgba(8,6,3,0.62) 38%, rgba(8,6,3,0.97) 100%)',
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 'calc(152px + var(--tg-safe-top, 60px))',
                        overflow: 'hidden',
                        opacity: 0.14,
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
                            fontSize: 58,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
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

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <img
                        src="/brand/logo-full-gold.svg"
                        alt="Premium House"
                        style={{
                            width: 'min(100%, 236px)',
                            height: 'auto',
                            display: 'block',
                            marginBottom: 12,
                            filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.4))',
                        }}
                    />

                    <div style={{ maxWidth: 340, marginBottom: 18 }}>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 14px',
                                borderRadius: 999,
                                border: '1px solid rgba(242,217,162,0.18)',
                                background: 'rgba(20,16,12,0.52)',
                                color: 'var(--color-brand-light)',
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                marginBottom: 14,
                            }}
                        >
                            <span>Telegram Mini App</span>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-gold)' }} />
                        </div>
                        <h1
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 44,
                                lineHeight: 0.95,
                                fontWeight: 700,
                                letterSpacing: '-0.04em',
                                marginBottom: 10,
                                color: '#fff7e8',
                                textShadow: '0 10px 30px rgba(0,0,0,0.28)',
                            }}
                        >
                            Uy qayerda ekanligi,
                            <br />
                            bron va to\'lov bir joyda
                        </h1>
                        <p
                            style={{
                                fontSize: 14,
                                lineHeight: 1.72,
                                color: 'rgba(247,239,222,0.78)',
                            }}
                        >
                            Endi foydalanuvchi uy manzilini faqat nomidan emas, detail ichidagi lokatsiya kartasi va xarita tugmalari orqali aniq ko\'radi.
                        </p>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 10,
                            marginBottom: 22,
                        }}
                    >
                        {[
                            { label: 'Premium uylar', value: total || properties.length || 0 },
                            { label: 'Shaharlar', value: cityCount },
                            { label: 'Band qilish', value: '24/7' },
                        ].map((item) => (
                            <div
                                key={item.label}
                                style={{
                                    padding: '12px 10px',
                                    borderRadius: 18,
                                    background: 'rgba(20,16,12,0.68)',
                                    border: '1px solid rgba(242,217,162,0.14)',
                                    backdropFilter: 'blur(16px)',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                            >
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff5df' }}>{item.value}</div>
                                <div style={{ fontSize: 11, color: 'rgba(242,217,162,0.72)' }}>{item.label}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ position: 'relative', height: 248 }}>
                        {previousHero && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    bottom: 16,
                                    width: 108,
                                    height: 148,
                                    borderRadius: 22,
                                    overflow: 'hidden',
                                    background: previousHero.cover_image
                                        ? `url(${previousHero.cover_image}) center/cover no-repeat`
                                        : heroFallbacks[(safeHeroIndex + 1) % heroFallbacks.length],
                                    border: '1px solid rgba(242,217,162,0.14)',
                                    boxShadow: 'var(--shadow-md)',
                                    transform: 'rotate(-8deg)',
                                    opacity: 0.76,
                                }}
                            >
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,3,0.06) 0%, rgba(8,6,3,0.82) 100%)' }} />
                            </div>
                        )}

                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 0,
                                transform: 'translateX(-50%)',
                                width: 'min(100%, 320px)',
                                height: 236,
                                borderRadius: 28,
                                overflow: 'hidden',
                                border: '1px solid rgba(242,217,162,0.18)',
                                background: currentHero?.cover_image
                                    ? `url(${currentHero.cover_image}) center/cover no-repeat`
                                    : heroFallbacks[safeHeroIndex % heroFallbacks.length],
                                boxShadow: 'var(--shadow-lg)',
                            }}
                        >
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,3,0.02) 0%, rgba(8,6,3,0.2) 34%, rgba(8,6,3,0.9) 100%)' }} />
                            <img
                                src="/brand/logo-mark-gold.svg"
                                alt="Premium House mark"
                                style={{
                                    position: 'absolute',
                                    top: 12,
                                    right: 12,
                                    width: 42,
                                    height: 42,
                                    filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.45))',
                                }}
                            />
                            {currentHero && (
                                <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
                                    <div
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            background: 'rgba(12,9,6,0.72)',
                                            border: '1px solid rgba(242,217,162,0.12)',
                                            color: 'var(--color-brand-light)',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            marginBottom: 10,
                                        }}
                                    >
                                        <img src="/brand/icon-location-gold.svg" alt="Lokatsiya" style={{ width: 14, height: 14 }} />
                                        <span>{currentHero.city}</span>
                                    </div>
                                    <h3
                                        style={{
                                            fontFamily: 'var(--font-display)',
                                            fontSize: 24,
                                            lineHeight: 1,
                                            fontWeight: 700,
                                            color: '#fff7e8',
                                            marginBottom: 8,
                                        }}
                                    >
                                        {currentHero.title}
                                    </h3>
                                    <div style={{ fontSize: 12, color: 'rgba(247,239,222,0.72)', marginBottom: 12 }}>
                                        {currentHero.address}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'rgba(242,217,162,0.72)', marginBottom: 2 }}>Bir kecha narxi</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff7e8' }}>
                                                {formatPrice(currentHero.price_per_night, currentHero.currency)}
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: 14,
                                                background: 'var(--gradient-brand)',
                                                color: 'var(--color-ink-soft)',
                                                fontSize: 12,
                                                fontWeight: 800,
                                                boxShadow: 'var(--shadow-glow)',
                                            }}
                                        >
                                            Lokatsiya ochiladi
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {nextHero && (
                            <div
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    bottom: 22,
                                    width: 116,
                                    height: 156,
                                    borderRadius: 22,
                                    overflow: 'hidden',
                                    background: nextHero.cover_image
                                        ? `url(${nextHero.cover_image}) center/cover no-repeat`
                                        : heroFallbacks[(safeHeroIndex + 2) % heroFallbacks.length],
                                    border: '1px solid rgba(242,217,162,0.14)',
                                    boxShadow: 'var(--shadow-md)',
                                    transform: 'rotate(8deg)',
                                    opacity: 0.84,
                                }}
                            >
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,3,0.06) 0%, rgba(8,6,3,0.82) 100%)' }} />
                            </div>
                        )}
                    </div>

                    {heroCount > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                            {heroProperties.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setHeroImageIndex(index)}
                                    style={{
                                        width: index === safeHeroIndex ? 28 : 8,
                                        height: 8,
                                        borderRadius: 999,
                                        border: 'none',
                                        background: index === safeHeroIndex ? 'var(--gradient-brand)' : 'rgba(255,247,232,0.26)',
                                        cursor: 'pointer',
                                        transition: 'all 0.24s ease',
                                        padding: 0,
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <div style={{ padding: '0 16px', marginTop: -88, position: 'relative', zIndex: 5 }}>
                <SearchFilter onSearch={fetchProperties} isLoading={isLoading} />
            </div>

            <div style={{ padding: '2px 16px 0' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 10,
                        marginBottom: 18,
                    }}
                >
                    {featureTiles.map((feature) => (
                        <div
                            key={feature.title}
                            style={{
                                padding: '14px 10px',
                                borderRadius: 20,
                                background: 'linear-gradient(180deg, rgba(20,16,12,0.92) 0%, rgba(20,16,12,0.76) 100%)',
                                border: '1px solid var(--color-line)',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                        >
                            <img src={feature.icon} alt={feature.title} style={{ width: 30, height: 30, marginBottom: 10 }} />
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff7e8', marginBottom: 6 }}>{feature.title}</div>
                            <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--color-muted)' }}>{feature.description}</div>
                        </div>
                    ))}
                </div>

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
                            Asosiy oynada rasmlar avtomatik almashadi va lokatsiya ko\'rinadi
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
                            <img src="/brand/icon-rating-gold.svg" alt="Natija yo'q" style={{ width: 46, height: 46, marginBottom: 12 }} />
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--color-text)', marginBottom: 8 }}>
                                Mos uy topilmadi
                            </div>
                            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                                Filtrlarni tozalang yoki boshqa sana va mehmon sonini sinab ko'ring.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
