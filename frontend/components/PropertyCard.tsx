'use client';

import Link from 'next/link';
import { haptic } from '../lib/telegram';
import type { PropertySummary } from '../lib/types';

function formatPrice(price: number, currency: string): string {
    if (currency === 'UZS') {
        return `${new Intl.NumberFormat('uz-UZ').format(price)} so'm`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

function PropertyTypeIcon({ type }: { type: string }) {
    const icons: Record<string, string> = {
        apartment: '🏢',
        house: '🏠',
        villa: '🏡',
    };
    return <span>{icons[type] || '🏠'}</span>;
}

export default function PropertyCard({ property }: { property: PropertySummary }) {
    const placeholderGradients = [
        'linear-gradient(135deg, #5f4320 0%, #1b140d 100%)',
        'linear-gradient(135deg, #c79b53 0%, #322314 100%)',
        'linear-gradient(135deg, #f2d9a2 0%, #6e4f28 100%)',
        'linear-gradient(135deg, #2b1d11 0%, #b88a45 100%)',
    ];

    const gradientIndex = property.id.charCodeAt(0) % placeholderGradients.length;

    return (
        <Link
            href={`/property/${property.id}`}
            onClick={() => haptic('light')}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
            <div
                className="hover-lift"
                style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, rgba(20,16,12,0.96) 0%, rgba(15,11,8,0.98) 100%)',
                    border: '1px solid var(--color-line)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: 146,
                        background: property.cover_image
                            ? `url(${property.cover_image}) center/cover no-repeat`
                            : placeholderGradients[gradientIndex],
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(180deg, rgba(8,6,3,0.08) 0%, rgba(8,6,3,0.52) 68%, rgba(8,6,3,0.78) 100%)',
                        }}
                    />

                    {!property.cover_image && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 48,
                                opacity: 0.62,
                            }}
                        >
                            <PropertyTypeIcon type={property.property_type} />
                        </div>
                    )}

                    <div
                        style={{
                            position: 'absolute',
                            bottom: 10,
                            left: 10,
                            background: 'rgba(12,9,6,0.74)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: 12,
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 4,
                            border: '1px solid rgba(242,217,162,0.12)',
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff7e8' }}>
                            {formatPrice(property.price_per_night, property.currency)}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(242,217,162,0.72)' }}>/kecha</span>
                    </div>

                    {property.average_rating > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                background: 'rgba(12,9,6,0.74)',
                                backdropFilter: 'blur(12px)',
                                borderRadius: 10,
                                padding: '5px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                border: '1px solid rgba(242,217,162,0.12)',
                            }}
                        >
                            <span style={{ fontSize: 13, color: 'var(--color-gold)' }}>★</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff7e8' }}>
                                {property.average_rating.toFixed(1)}
                            </span>
                        </div>
                    )}

                    <div
                        style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            background: 'rgba(247,239,222,0.1)',
                            borderRadius: 10,
                            padding: '5px 10px',
                            fontSize: 10,
                            fontWeight: 800,
                            color: 'var(--color-brand-light)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            border: '1px solid rgba(242,217,162,0.16)',
                        }}
                    >
                        {property.property_type}
                    </div>
                </div>

                <div style={{ padding: '12px 12px 14px' }}>
                    <h3
                        className="line-clamp-2"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            fontWeight: 700,
                            lineHeight: 1.04,
                            marginBottom: 8,
                            minHeight: 38,
                            color: '#fff7e8',
                        }}
                    >
                        {property.title}
                    </h3>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            color: 'var(--color-muted)',
                            fontSize: 11,
                            marginBottom: 5,
                        }}
                    >
                        <img src="/brand/icon-location-gold.svg" alt="Lokatsiya" style={{ width: 12, height: 12, flexShrink: 0 }} />
                        <span className="truncate">{property.city}</span>
                    </div>
                    <div
                        className="line-clamp-2"
                        style={{
                            fontSize: 11,
                            lineHeight: 1.5,
                            color: 'rgba(247,239,222,0.64)',
                            minHeight: 32,
                        }}
                    >
                        {property.address}
                    </div>
                </div>
            </div>
        </Link>
    );
}

export function PropertyCardSkeleton() {
    return (
        <div
            style={{
                borderRadius: 18,
                overflow: 'hidden',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
            }}
        >
            <div className="skeleton" style={{ width: '100%', height: 146, borderRadius: 0 }} />
            <div style={{ padding: '12px' }}>
                <div className="skeleton" style={{ width: '100%', height: 16, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '80%', height: 16, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: '60%', height: 10 }} />
            </div>
        </div>
    );
}
