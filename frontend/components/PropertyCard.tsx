'use client';

import Link from 'next/link';
import PriceDisplay from './PriceDisplay';
import { useAppPreferences } from '../context/AppPreferencesContext';
import { haptic } from '../lib/telegram';
import type { PropertySummary } from '../lib/types';

function PropertyTypeIcon({ type }: { type: string }) {
    const icons: Record<string, string> = {
        apartment: '🏢',
        house: '🏠',
        villa: '🏡',
    };
    return <span>{icons[type] || '🏠'}</span>;
}

export default function PropertyCard({ property }: { property: PropertySummary }) {
    const { t } = useAppPreferences();
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
                            background: 'linear-gradient(180deg, rgba(8,6,3,0.02) 0%, rgba(8,6,3,0.18) 58%, rgba(8,6,3,0.42) 100%)',
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

                    {property.average_rating > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                background: 'rgba(12,9,6,0.84)',
                                backdropFilter: 'blur(18px)',
                                WebkitBackdropFilter: 'blur(18px)',
                                borderRadius: 12,
                                padding: '7px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                border: '1px solid rgba(242,217,162,0.18)',
                                boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
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
                            background: 'rgba(12,9,6,0.84)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderRadius: 12,
                            padding: '7px 12px',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#f2d9a2',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            border: '1px solid rgba(242,217,162,0.22)',
                            boxShadow: '0 14px 28px rgba(0,0,0,0.2)',
                        }}
                    >
                        {t(`propertyType.${property.property_type}`)}
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
                            marginBottom: 10,
                            padding: '10px 12px',
                            borderRadius: 14,
                            background: 'rgba(255,247,232,0.03)',
                            border: '1px solid rgba(242,217,162,0.12)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                            <PriceDisplay
                                amount={property.price_per_night}
                                baseCurrency={property.currency}
                                primaryStyle={{ fontSize: 13, fontWeight: 800, color: '#fff7e8' }}
                                secondaryStyle={{ fontSize: 10, color: 'rgba(242,217,162,0.72)' }}
                                wrapperStyle={{ gap: 2 }}
                            />
                            <span style={{ fontSize: 11, color: 'rgba(242,217,162,0.72)' }}>
                                {t('units.perNight')}
                            </span>
                        </div>
                    </div>

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
