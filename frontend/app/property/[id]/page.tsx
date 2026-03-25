'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProperty } from '../../../lib/api';
import { getTelegramWebApp, haptic } from '../../../lib/telegram';
import type { PropertyDetail } from '../../../lib/types';
import PropertyGallery from '../../../components/PropertyGallery';
import { DetailSkeleton } from '../../../components/LoadingSkeleton';

function formatPrice(price: number, currency: string): string {
    if (currency === 'UZS') {
        return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

const amenityIcons: Record<string, string> = {
    wifi: '📶', parking: '🅿️', pool: '🏊', gym: '💪', ac: '❄️',
    heating: '🔥', kitchen: '🍳', washer: '🧺', dryer: '👕', tv: '📺',
    balcony: '🌇', garden: '🌿', bbq: '🍖', elevator: '🛗', security: '🔒',
    pets_allowed: '🐾', smoking_allowed: '🚬', breakfast: '🍞', airport_transfer: '✈️',
    spa: '💆', sauna: '🧖', playground: '🎠', concierge: '🛎️',
};

function openExternalLink(url: string) {
    const tg = getTelegramWebApp();
    if (tg?.openLink) {
        tg.openLink(url);
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

export default function PropertyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [property, setProperty] = useState<PropertyDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const id = params.id as string;
                const data = await getProperty(id);
                setProperty(data);
            } catch (err) {
                setError('Uy topilmadi');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProperty();
    }, [params.id]);

    if (isLoading) return <DetailSkeleton />;
    if (error || !property) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text)', marginBottom: 8 }}>
                    {error || 'Uy topilmadi'}
                </h2>
                <button
                    onClick={() => router.back()}
                    style={{
                        padding: '10px 24px',
                        borderRadius: 12,
                        background: 'var(--gradient-brand)',
                        color: 'var(--color-ink-soft)',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                    }}
                >
                    ← Orqaga
                </button>
            </div>
        );
    }

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`;
    const yandexMapsUrl = `https://yandex.com/maps/?ll=${property.longitude}%2C${property.latitude}&z=16&pt=${property.longitude},${property.latitude},pm2dgl`;

    return (
        <div style={{ minHeight: '100vh', paddingBottom: 100 }}>
            {/* Back button */}
            <button
                onClick={() => { haptic('light'); router.back(); }}
                style={{
                    position: 'fixed',
                    top: 'calc(16px + var(--tg-safe-top, 60px))',
                    left: 16,
                    zIndex: 50,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'rgba(12,9,6,0.62)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(242,217,162,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff7e8" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>

            {/* Gallery */}
            <PropertyGallery
                images={property.images}
                title={property.title}
                propertyType={property.property_type}
            />

            {/* Content */}
            <div style={{ padding: '0 16px 20px', marginTop: -28, position: 'relative', zIndex: 2 }}>
                <div
                    style={{
                        padding: '18px 18px 16px',
                        borderRadius: 24,
                        background: 'linear-gradient(180deg, rgba(20,16,12,0.96) 0%, rgba(10,8,6,0.98) 100%)',
                        border: '1px solid rgba(242,217,162,0.12)',
                        boxShadow: 'var(--shadow-lg)',
                        marginBottom: 18,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <span
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: 999,
                                    background: 'rgba(210, 174, 104, 0.16)',
                                    color: 'var(--color-brand-light)',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {property.property_type}
                            </span>
                            <span
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: 999,
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'rgba(255,247,232,0.82)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                }}
                            >
                                {property.capacity} kishilik
                            </span>
                        </div>
                        {property.average_rating > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: 16, color: 'var(--color-gold)' }}>★</span>
                                <span style={{ fontSize: 14, fontWeight: 800 }}>{property.average_rating.toFixed(1)}</span>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>({property.review_count})</span>
                            </div>
                        )}
                    </div>

                    <h1
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 28,
                            fontWeight: 800,
                            lineHeight: 1.05,
                            marginBottom: 12,
                        }}
                    >
                        {property.title}
                    </h1>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'var(--color-muted)',
                            fontSize: 14,
                            marginBottom: 16,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{property.address}, {property.city}</span>
                    </div>

                    <div
                        style={{
                            padding: '14px 16px',
                            borderRadius: 18,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(210,174,104,0.12) 100%)',
                            border: '1px solid rgba(242,217,162,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 12, color: 'rgba(255,247,232,0.62)', marginBottom: 4 }}>Bir kecha narxi</div>
                            <div style={{ fontSize: 24, fontWeight: 800 }}>
                                <span className="text-gradient">{formatPrice(property.price_per_night, property.currency)}</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(255,247,232,0.7)', lineHeight: 1.5 }}>
                            <div>Faqat uy narxi</div>
                            <div>Yashirin servis to'lovi yo'q</div>
                        </div>
                    </div>
                </div>

                {/* Host info */}
                {property.host && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '16px 18px',
                            borderRadius: 20,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            marginBottom: 20,
                        }}
                    >
                        <div
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 16,
                                background: property.host.photo_url
                                    ? `url(${property.host.photo_url}) center/cover`
                                    : 'var(--gradient-brand)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                color: 'var(--color-ink-soft)',
                                fontWeight: 700,
                            }}
                        >
                            {!property.host.photo_url && property.host.first_name[0]}
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>
                                {property.host.first_name} {property.host.last_name || ''}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Premium House host</div>
                        </div>
                    </div>
                )}

                {/* Features grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 12,
                        marginBottom: 20,
                    }}
                >
                    {[
                        { icon: '👥', label: 'Mehmonlar', value: `${property.capacity} kishi` },
                        { icon: '🚪', label: 'Xonalar', value: `${property.rooms} ta` },
                        { icon: '🚿', label: 'Hammom', value: `${property.bathrooms} ta` },
                    ].map((f) => (
                        <div
                            key={f.label}
                            style={{
                                padding: '16px 12px',
                                borderRadius: 18,
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                                border: '1px solid var(--color-line)',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: 24, marginBottom: 4 }}>{f.icon}</div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{f.value}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{f.label}</div>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        marginBottom: 20,
                        padding: '18px',
                        borderRadius: 24,
                        background: 'linear-gradient(180deg, rgba(20,16,12,0.96) 0%, rgba(13,10,7,0.98) 100%)',
                        border: '1px solid rgba(242,217,162,0.12)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 18,
                                background: 'rgba(255,247,232,0.04)',
                                border: '1px solid rgba(242,217,162,0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <img src="/brand/icon-location-gold.svg" alt="Lokatsiya" style={{ width: 28, height: 28 }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-brand-light)', marginBottom: 4 }}>
                                Lokatsiya
                            </div>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                                Uy qayerda joylashgan
                            </h2>
                        </div>
                    </div>

                    <div
                        style={{
                            padding: '14px 16px',
                            borderRadius: 18,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(210,174,104,0.12) 100%)',
                            border: '1px solid rgba(242,217,162,0.12)',
                            marginBottom: 14,
                        }}
                    >
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff7e8', marginBottom: 6 }}>
                            {property.address}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.7 }}>
                            {property.city}, {property.region}
                            <br />
                            Koordinata: {property.latitude.toFixed(5)}, {property.longitude.toFixed(5)}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <button
                            type="button"
                            onClick={() => {
                                haptic('medium');
                                openExternalLink(googleMapsUrl);
                            }}
                            style={{
                                padding: '14px 12px',
                                borderRadius: 16,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: 'var(--color-ink-soft)',
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                                boxShadow: 'var(--shadow-glow)',
                            }}
                        >
                            Google Maps
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                haptic('light');
                                openExternalLink(yandexMapsUrl);
                            }}
                            style={{
                                padding: '14px 12px',
                                borderRadius: 16,
                                border: '1px solid var(--color-line)',
                                background: 'rgba(255,247,232,0.04)',
                                color: 'var(--color-text)',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            Yandex xarita
                        </button>
                    </div>
                </div>

                {/* Description */}
                <div
                    style={{
                        marginBottom: 20,
                        padding: '18px',
                        borderRadius: 20,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-line)',
                    }}
                >
                    <h2
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 10,
                        }}
                    >
                        Tavsif
                    </h2>
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--color-muted)' }}>
                        {property.description}
                    </p>
                </div>

                {/* Amenities */}
                {property.amenities.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <h2
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                marginBottom: 12,
                            }}
                        >
                            Qulayliklar
                        </h2>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 10,
                            }}
                        >
                            {property.amenities.map((a) => (
                                <div
                                    key={a.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '12px 14px',
                                        borderRadius: 14,
                                        background: 'var(--color-surface)',
                                        border: '1px solid var(--color-line)',
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span>{amenityIcons[a.code] || a.icon || '✅'}</span>
                                    <span>{a.name_uz}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* House rules */}
                {property.house_rules && (
                    <div style={{ marginBottom: 20 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                            Uy qoidalari
                        </h2>
                        <div
                            style={{
                                padding: '16px 18px',
                                borderRadius: 18,
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-line)',
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: 'var(--color-muted)',
                            }}
                        >
                            {property.house_rules}
                        </div>
                    </div>
                )}

                {/* Cancellation */}
                {property.cancellation_policy && (
                    <div style={{ marginBottom: 20 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                            Bekor qilish siyosati
                        </h2>
                        <div
                            style={{
                                padding: '16px 18px',
                                borderRadius: 18,
                                background: 'rgba(210, 174, 104, 0.1)',
                                border: '1px solid rgba(210, 174, 104, 0.18)',
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: 'var(--color-muted)',
                            }}
                        >
                            ⚠️ {property.cancellation_policy}
                        </div>
                    </div>
                )}

                {/* Price breakdown */}
                <div
                    style={{
                        padding: '18px 16px',
                        borderRadius: 20,
                        background: 'var(--gradient-card)',
                        border: '1px solid var(--color-line)',
                        marginBottom: 20,
                    }}
                    >
                        <h2
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                marginBottom: 14,
                            }}
                        >
                        Narx
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                            <span style={{ fontWeight: 700 }}>Bir kecha narxi</span>
                            <span className="text-gradient" style={{ fontWeight: 800 }}>
                                {formatPrice(property.price_per_night, property.currency)}
                            </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                            Bron summasi faqat tanlangan kechalar soni bo'yicha hisoblanadi.
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed booking bar */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'rgba(8, 6, 3, 0.9)',
                    backdropFilter: 'blur(20px)',
                    borderTop: '1px solid var(--color-line)',
                    padding: '12px 16px',
                    paddingBottom: 'calc(12px + var(--safe-area-bottom, 0px))',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        maxWidth: 480,
                        margin: '0 auto',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                            <span className="text-gradient">{formatPrice(property.price_per_night, property.currency)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>bir kecha uchun</div>
                    </div>
                    <button
                        onClick={() => {
                            haptic('medium');
                            router.push(`/booking?property=${property.id}`);
                        }}
                        style={{
                            padding: '14px 32px',
                            borderRadius: 14,
                            border: 'none',
                            background: 'var(--gradient-brand)',
                            color: 'var(--color-ink-soft)',
                            fontSize: 15,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)',
                            boxShadow: 'var(--shadow-glow)',
                            transition: 'transform 0.2s ease',
                        }}
                    >
                        Band qilish
                    </button>
                </div>
            </div>
        </div>
    );
}
