'use client';

import { useState } from 'react';
import type { PropertyImage } from '@/lib/types';

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
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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
                height: 'calc(300px + var(--tg-safe-top, 60px))',
                paddingTop: 'var(--tg-safe-top, 60px)',
                overflow: 'hidden',
                borderRadius: '0 0 24px 24px',
                background: 'var(--color-surface)',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Slide container */}
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
                        <span style={{ fontSize: 64, opacity: 0.5 }}>{icons[propertyType || ''] || '🏠'}</span>
                        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{title}</span>
                    </div>
                )}
            </div>

            {/* Gradient overlay */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 100,
                    background: 'linear-gradient(to top, rgba(15,15,20,0.8), transparent)',
                    pointerEvents: 'none',
                }}
            />

            {/* Dots indicator */}
            {hasImages && images.length > 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 16,
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
                                width: i === currentIndex ? 20 : 6,
                                height: 6,
                                borderRadius: 3,
                                border: 'none',
                                background: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Navigation Arrows */}
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
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(8px)',
                            border: 'none',
                            color: '#fff',
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
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(8px)',
                            border: 'none',
                            color: '#fff',
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

            {/* Counter badge */}
            {hasImages && images.length > 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.8)',
                        fontWeight: 500,
                    }}
                >
                    {currentIndex + 1} / {images.length}
                </div>
            )}
        </div>
    );
}
