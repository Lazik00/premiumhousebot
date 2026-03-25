'use client';

import { useEffect, useState, useCallback, type TouchEvent } from 'react';
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
    const [isLoading, setIsLoading] = useState(true);
    const [activeType, setActiveType] = useState('');
    const [heroImageIndex, setHeroImageIndex] = useState(0);
    const [isDraggingHero, setIsDraggingHero] = useState(false);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [touchCurrentY, setTouchCurrentY] = useState<number | null>(null);

    const fetchProperties = useCallback(async (filters: FilterValues = {}) => {
        setIsLoading(true);
        try {
            const res = await listProperties({ ...filters, limit: 20, offset: 0 });
            setProperties(res.items);
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
        if (heroCount <= 1 || isDraggingHero) return;
        const interval = setInterval(() => {
            setHeroImageIndex((prev) => (prev + 1) % heroCount);
        }, 3200);
        return () => clearInterval(interval);
    }, [heroCount, isDraggingHero]);

    const filteredProperties = activeType
        ? properties.filter((property) => property.property_type === activeType)
        : properties;

    const goToHero = (index: number) => {
        if (heroCount <= 0) return;
        setHeroImageIndex((index + heroCount) % heroCount);
    };

    const goToNextHero = () => {
        if (heroCount <= 1) return;
        setHeroImageIndex((prev) => (prev + 1) % heroCount);
    };

    const goToPreviousHero = () => {
        if (heroCount <= 1) return;
        setHeroImageIndex((prev) => (prev - 1 + heroCount) % heroCount);
    };

    const handleHeroTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        const x = event.targetTouches[0]?.clientX ?? null;
        const y = event.targetTouches[0]?.clientY ?? null;
        setIsDraggingHero(true);
        setDragOffsetX(0);
        setTouchStartX(x);
        setTouchCurrentX(x);
        setTouchStartY(y);
        setTouchCurrentY(y);
    };

    const handleHeroTouchMove = (event: TouchEvent<HTMLDivElement>) => {
        const nextX = event.targetTouches[0]?.clientX ?? null;
        const nextY = event.targetTouches[0]?.clientY ?? null;
        setTouchCurrentX(nextX);
        setTouchCurrentY(nextY);

        if (touchStartX !== null && touchStartY !== null && nextX !== null && nextY !== null) {
            const deltaX = Math.abs(touchStartX - nextX);
            const deltaY = Math.abs(touchStartY - nextY);
            const signedDeltaX = nextX - touchStartX;

            setDragOffsetX(Math.max(Math.min(signedDeltaX, 130), -130));

            if (deltaX > 8 && deltaX > deltaY) {
                event.preventDefault();
            }
        }
    };

    const handleHeroTouchEnd = () => {
        if (touchStartX === null || touchCurrentX === null || touchStartY === null || touchCurrentY === null) {
            setIsDraggingHero(false);
            setDragOffsetX(0);
            setTouchStartX(null);
            setTouchCurrentX(null);
            setTouchStartY(null);
            setTouchCurrentY(null);
            return;
        }
        const deltaX = touchStartX - touchCurrentX;
        const deltaY = touchStartY - touchCurrentY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 34) {
            if (deltaX > 0) goToNextHero();
            else goToPreviousHero();
        }
        setIsDraggingHero(false);
        setDragOffsetX(0);
        setTouchStartX(null);
        setTouchCurrentX(null);
        setTouchStartY(null);
        setTouchCurrentY(null);
    };

    const heroDragProgress = Math.max(Math.min(dragOffsetX / 120, 1), -1);
    const heroTransition = isDraggingHero ? 'none' : 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease, filter 320ms ease';
    const centerTransform = `translateX(calc(-50% + ${dragOffsetX}px)) rotateY(${-heroDragProgress * 14}deg) rotateZ(${heroDragProgress * 1.8}deg) scale(${isDraggingHero ? 1.015 : 1})`;
    const previousTransform = `translateX(${dragOffsetX * 0.28}px) rotate(${(-10 + heroDragProgress * 8).toFixed(2)}deg) scale(${(0.9 + Math.max(heroDragProgress, 0) * 0.1).toFixed(3)})`;
    const nextTransform = `translateX(${dragOffsetX * 0.28}px) rotate(${(10 + heroDragProgress * 8).toFixed(2)}deg) scale(${(0.92 + Math.max(-heroDragProgress, 0) * 0.1).toFixed(3)})`;
    const previousOpacity = Math.max(0.18, 0.4 + Math.max(heroDragProgress, 0) * 0.44);
    const nextOpacity = Math.max(0.18, 0.44 + Math.max(-heroDragProgress, 0) * 0.42);

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
                            marginBottom: 18,
                            filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.4))',
                        }}
                    />

                    <div
                        style={{
                            position: 'relative',
                            height: 278,
                            touchAction: 'none',
                            overscrollBehavior: 'contain',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                        }}
                        onTouchStart={handleHeroTouchStart}
                        onTouchMove={handleHeroTouchMove}
                        onTouchEnd={handleHeroTouchEnd}
                    >
                        {previousHero && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: -22,
                                    bottom: 26,
                                    width: 96,
                                    height: 136,
                                    borderRadius: 22,
                                    overflow: 'hidden',
                                    background: previousHero.cover_image
                                        ? `url(${previousHero.cover_image}) center/cover no-repeat`
                                        : heroFallbacks[(safeHeroIndex + 1) % heroFallbacks.length],
                                    border: '1px solid rgba(242,217,162,0.14)',
                                    boxShadow: 'var(--shadow-md)',
                                    transform: previousTransform,
                                    opacity: previousOpacity,
                                    filter: `blur(${(1.6 - Math.max(heroDragProgress, 0) * 1.2).toFixed(2)}px) saturate(${(0.85 + Math.max(heroDragProgress, 0) * 0.25).toFixed(2)})`,
                                    zIndex: 1,
                                    transition: heroTransition,
                                }}
                            >
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,3,0.24) 0%, rgba(8,6,3,0.9) 100%)' }} />
                            </div>
                        )}

                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 0,
                                transform: centerTransform,
                                transformStyle: 'preserve-3d',
                                width: 'min(100%, 332px)',
                                height: 258,
                                borderRadius: 30,
                                overflow: 'hidden',
                                border: '1px solid rgba(242,217,162,0.22)',
                                background: currentHero?.cover_image
                                    ? `url(${currentHero.cover_image}) center/cover no-repeat`
                                    : heroFallbacks[safeHeroIndex % heroFallbacks.length],
                                boxShadow: isDraggingHero ? '0 40px 84px rgba(0,0,0,0.54)' : '0 34px 70px rgba(0,0,0,0.46)',
                                zIndex: 3,
                                transition: heroTransition,
                            }}
                        >
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,3,0.02) 0%, rgba(8,6,3,0.14) 24%, rgba(8,6,3,0.82) 100%)' }} />
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: `linear-gradient(${100 - heroDragProgress * 16}deg, rgba(255,247,232,${isDraggingHero ? 0.12 : 0.05}) 0%, transparent 34%, transparent 68%, rgba(210,174,104,${isDraggingHero ? 0.18 : 0.08}) 100%)`,
                                    mixBlendMode: 'screen',
                                    pointerEvents: 'none',
                                }}
                            />
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
                                        <div />
                                    </div>
                                </div>
                            )}
                        </div>

                        {nextHero && (
                            <div
                                style={{
                                    position: 'absolute',
                                    right: -28,
                                    bottom: 30,
                                    width: 102,
                                    height: 144,
                                    borderRadius: 22,
                                    overflow: 'hidden',
                                    background: nextHero.cover_image
                                        ? `url(${nextHero.cover_image}) center/cover no-repeat`
                                        : heroFallbacks[(safeHeroIndex + 2) % heroFallbacks.length],
                                    border: '1px solid rgba(242,217,162,0.14)',
                                    boxShadow: 'var(--shadow-md)',
                                    transform: nextTransform,
                                    opacity: nextOpacity,
                                    filter: `blur(${(1.6 - Math.max(-heroDragProgress, 0) * 1.2).toFixed(2)}px) saturate(${(0.85 + Math.max(-heroDragProgress, 0) * 0.25).toFixed(2)})`,
                                    zIndex: 1,
                                    transition: heroTransition,
                                }}
                            >
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,3,0.24) 0%, rgba(8,6,3,0.9) 100%)' }} />
                            </div>
                        )}
                    </div>

                    {heroCount > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                            {heroProperties.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => goToHero(index)}
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

            <div style={{ padding: '10px 16px 0' }}>
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
