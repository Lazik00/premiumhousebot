'use client';

import Link from 'next/link';
import { haptic } from '../lib/telegram';
import type { PropertySummary } from '../lib/types';

function formatPrice(price: number, currency: string): string {
    if (currency === 'UZS') {
        return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
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
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
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
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Image */}
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: 140,
                        background: property.cover_image
                            ? `url(${property.cover_image}) center/cover no-repeat`
                            : placeholderGradients[gradientIndex],
                        overflow: 'hidden',
                    }}
                >
                    {!property.cover_image && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 48,
                                opacity: 0.6,
                            }}
                        >
                            <PropertyTypeIcon type={property.property_type} />
                        </div>
                    )}

                    {/* Price badge */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: 10,
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 4,
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                            {formatPrice(property.price_per_night, property.currency)}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>/kecha</span>
                    </div>

                    {/* Rating badge */}
                    {property.average_rating > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                background: 'rgba(0,0,0,0.7)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: 8,
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <span style={{ fontSize: 13, color: '#ffeaa7' }}>★</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                                {property.average_rating.toFixed(1)}
                            </span>
                        </div>
                    )}

                    {/* Property type badge */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            background: 'var(--gradient-brand)',
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fff',
                            textTransform: 'capitalize',
                        }}
                    >
                        {property.property_type}
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '10px 12px' }}>
                    <h3
                        className="line-clamp-2"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: 1.2,
                            marginBottom: 4,
                            minHeight: 31,
                        }}
                    >
                        {property.title}
                    </h3>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'var(--color-muted)',
                            fontSize: 11,
                            marginBottom: 0,
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="truncate">{property.city}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

/* ===== Skeleton ===== */
export function PropertyCardSkeleton() {
    return (
        <div
            style={{
                borderRadius: 16,
                overflow: 'hidden',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
            }}
        >
            <div className="skeleton" style={{ width: '100%', height: 140, borderRadius: 0 }} />
            <div style={{ padding: '10px 12px' }}>
                <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '80%', height: 14, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '60%', height: 10 }} />
            </div>
        </div>
    );
}
