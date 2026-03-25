'use client';

import { useState } from 'react';
import type { PropertyImage } from '../lib/types';

interface PropertyGalleryProps {
    images: PropertyImage[];
    title: string;
    propertyType?: string;
}

export default function PropertyGallery({ images, title, propertyType }: PropertyGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    const placeholderGradients = [
        'linear-gradient(135deg, #5f4320 0%, #1b140d 100%)',
        'linear-gradient(135deg, #c79b53 0%, #322314 100%)',
        'linear-gradient(135deg, #f2d9a2 0%, #6e4f28 100%)',
    ];

    const hasImages = images.length > 0;

    const goTo = (idx: number) => {
        if (idx >= 0 && idx < (hasImages ? images.length : 1)) {
            setCurrentIndex(idx);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
    const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (Math.abs(distance) > 50) {
            if (distance > 0) goTo(currentIndex + 1);
            else goTo(currentIndex - 1);
        }
        setTouchStart(0);
        setTouchEnd(0);
    };

    const icons: Record<string, string> = { apartment: '🏢', house: '🏠', villa: '🏡' };

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: 'calc(320px + var(--tg-safe-top, 60px))',
                paddingTop: 'var(--tg-safe-top, 60px)',
                overflow: 'hidden',
                borderRadius: '0 0 32px 32px',
                background: 'var(--color-surface)',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div
                style={{
                    display: 'flex',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: `translateX(-${currentIndex * 100}%)`,
                    height: '100%',
                }}
            >
                {hasImages ? (
                    images.map((img) => (
                        <div
                            key={img.id}
                            style={{
                                minWidth: '100%',
                                height: '100%',
                                background: `url(${img.image_url}) center/cover no-repeat`,
                            }}
                        />
                    ))
                ) : (
                    <div
                        style={{
                            minWidth: '100%',
                            height: '100%',
                            background: placeholderGradients[0],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <span style={{ fontSize: 64, opacity: 0.6 }}>{icons[propertyType || ''] || '🏠'}</span>
                        <span style={{ fontSize: 16, color: 'rgba(255,247,232,0.76)', fontFamily: 'var(--font-display)' }}>{title}</span>
                    </div>
                )}
            </div>

            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(8,6,3,0.05) 0%, rgba(8,6,3,0.2) 50%, rgba(8,6,3,0.82) 100%)',
                    pointerEvents: 'none',
                }}
            />

            {hasImages && images.length > 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 18,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 6,
                    }}
                >
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                width: i === currentIndex ? 22 : 7,
                                height: 7,
                                borderRadius: 999,
                                border: 'none',
                                background: i === currentIndex ? 'var(--gradient-brand)' : 'rgba(255,247,232,0.34)',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        />
                    ))}
                </div>
            )}

            {hasImages && images.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }}
                        disabled={currentIndex === 0}
                        style={{
                            position: 'absolute',
                            left: 16,
                            top: 'max(50%, calc(var(--tg-safe-top, 60px) + 50%))',
                            transform: 'translateY(-50%)',
                            width: 38,
                            height: 38,
                            borderRadius: 18,
                            background: 'rgba(12,9,6,0.62)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(242,217,162,0.14)',
                            color: '#fff7e8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                            opacity: currentIndex === 0 ? 0.3 : 1,
                            transition: 'opacity 0.2s',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }}
                        disabled={currentIndex === images.length - 1}
                        style={{
                            position: 'absolute',
                            right: 16,
                            top: 'max(50%, calc(var(--tg-safe-top, 60px) + 50%))',
                            transform: 'translateY(-50%)',
                            width: 38,
                            height: 38,
                            borderRadius: 18,
                            background: 'rgba(12,9,6,0.62)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(242,217,162,0.14)',
                            color: '#fff7e8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: currentIndex === images.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: currentIndex === images.length - 1 ? 0.3 : 1,
                            transition: 'opacity 0.2s',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </>
            )}

            {hasImages && images.length > 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 18,
                        right: 16,
                        background: 'rgba(12,9,6,0.64)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: 10,
                        padding: '4px 10px',
                        fontSize: 12,
                        color: 'rgba(255,247,232,0.84)',
                        fontWeight: 600,
                        border: '1px solid rgba(242,217,162,0.12)',
                    }}
                >
                    {currentIndex + 1} / {images.length}
                </div>
            )}
        </div>
    );
}
