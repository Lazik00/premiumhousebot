'use client';

import { useMemo, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import type { PropertyImage } from '../lib/types';

interface PropertyGalleryProps {
    images: PropertyImage[];
    title: string;
    propertyType?: string;
}

interface SwipeState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    lockedAxis: 'x' | 'y' | null;
    dragging: boolean;
}

const SWIPE_THRESHOLD = 48;
const AXIS_LOCK_THRESHOLD = 10;

function createInitialSwipeState(): SwipeState {
    return {
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        lockedAxis: null,
        dragging: false,
    };
}

export default function PropertyGallery({ images, title, propertyType }: PropertyGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewerOpen, setViewerOpen] = useState(false);
    const swipeStateRef = useRef<SwipeState>(createInitialSwipeState());
    const suppressClickRef = useRef(false);

    const placeholderGradients = [
        'linear-gradient(135deg, #5f4320 0%, #1b140d 100%)',
        'linear-gradient(135deg, #c79b53 0%, #322314 100%)',
        'linear-gradient(135deg, #f2d9a2 0%, #6e4f28 100%)',
    ];

    const hasImages = images.length > 0;
    const slideCount = hasImages ? images.length : 1;
    const icons: Record<string, string> = { apartment: '🏢', house: '🏠', villa: '🏡' };

    const currentImage = useMemo(() => (hasImages ? images[currentIndex] : null), [currentIndex, hasImages, images]);

    const goTo = (idx: number) => {
        if (idx >= 0 && idx < slideCount) {
            setCurrentIndex(idx);
        }
    };

    const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
        const touch = event.targetTouches[0];
        swipeStateRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            lockedAxis: null,
            dragging: false,
        };
        suppressClickRef.current = false;
    };

    const handleTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
        const touch = event.targetTouches[0];
        const state = swipeStateRef.current;
        state.currentX = touch.clientX;
        state.currentY = touch.clientY;

        const deltaX = state.currentX - state.startX;
        const deltaY = state.currentY - state.startY;

        if (!state.lockedAxis) {
            if (Math.abs(deltaX) < AXIS_LOCK_THRESHOLD && Math.abs(deltaY) < AXIS_LOCK_THRESHOLD) {
                return;
            }
            state.lockedAxis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
        }

        if (state.lockedAxis === 'x') {
            state.dragging = true;
            suppressClickRef.current = true;
            event.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        const state = swipeStateRef.current;
        if (state.lockedAxis === 'x') {
            const distance = state.startX - state.currentX;
            if (Math.abs(distance) > SWIPE_THRESHOLD) {
                if (distance > 0) {
                    goTo(currentIndex + 1);
                } else {
                    goTo(currentIndex - 1);
                }
            }
        }
        swipeStateRef.current = createInitialSwipeState();
        window.setTimeout(() => {
            suppressClickRef.current = false;
        }, 120);
    };

    const openViewer = () => {
        if (!hasImages || suppressClickRef.current) return;
        setViewerOpen(true);
    };

    const closeViewer = () => {
        setViewerOpen(false);
    };

    const renderSlides = (isViewer = false) => (
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
                    <button
                        key={img.id}
                        type="button"
                        onClick={openViewer}
                        style={{
                            minWidth: '100%',
                            height: '100%',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            cursor: isViewer ? 'default' : 'zoom-in',
                            background: `url(${img.image_url}) center/${isViewer ? 'contain' : 'cover'} no-repeat`,
                            backgroundColor: '#080603',
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
    );

    return (
        <>
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: 'calc(320px + var(--tg-safe-top, 60px))',
                    paddingTop: 'var(--tg-safe-top, 60px)',
                    overflow: 'hidden',
                    borderRadius: '0 0 32px 32px',
                    background: 'var(--color-surface)',
                    touchAction: 'pan-x',
                    overscrollBehavior: 'contain',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {renderSlides()}

                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(8,6,3,0.05) 0%, rgba(8,6,3,0.2) 50%, rgba(8,6,3,0.82) 100%)',
                        pointerEvents: 'none',
                    }}
                />

                {hasImages && (
                    <button
                        type="button"
                        onClick={openViewer}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'zoom-in',
                        }}
                        aria-label={`${title} image viewer`}
                    />
                )}

                {hasImages && images.length > 1 && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 20,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            gap: 6,
                            zIndex: 3,
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
                                top: '50%',
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
                                zIndex: 3,
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
                                top: '50%',
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
                                zIndex: 3,
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
                            bottom: 74,
                            right: 16,
                            background: 'rgba(12,9,6,0.64)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: 10,
                            padding: '4px 10px',
                            fontSize: 12,
                            color: 'rgba(255,247,232,0.84)',
                            fontWeight: 600,
                            border: '1px solid rgba(242,217,162,0.12)',
                            zIndex: 3,
                        }}
                    >
                        {currentIndex + 1} / {images.length}
                    </div>
                )}
            </div>

            {viewerOpen && currentImage ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 140,
                        background: 'rgba(8,6,3,0.94)',
                        backdropFilter: 'blur(16px)',
                        touchAction: 'pan-x',
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <button
                        type="button"
                        onClick={closeViewer}
                        style={{
                            position: 'absolute',
                            top: 'calc(34px + var(--tg-safe-top, 60px))',
                            right: 16,
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            border: '1px solid rgba(242,217,162,0.16)',
                            background: 'rgba(255,247,232,0.06)',
                            color: '#fff7e8',
                            fontSize: 22,
                            zIndex: 4,
                        }}
                    >
                        ×
                    </button>

                    <div
                        style={{
                            position: 'absolute',
                            inset: 'calc(42px + var(--tg-safe-top, 60px)) 14px 24px',
                            borderRadius: 24,
                            overflow: 'hidden',
                            background: '#080603',
                        }}
                    >
                        {renderSlides(true)}
                    </div>

                    {images.length > 1 ? (
                        <>
                            <button
                                type="button"
                                onClick={() => goTo(currentIndex - 1)}
                                disabled={currentIndex === 0}
                                style={{
                                    position: 'absolute',
                                    left: 18,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 44,
                                    height: 44,
                                    borderRadius: 999,
                                    border: '1px solid rgba(242,217,162,0.16)',
                                    background: 'rgba(12,9,6,0.62)',
                                    color: '#fff7e8',
                                    opacity: currentIndex === 0 ? 0.3 : 1,
                                    zIndex: 4,
                                }}
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={() => goTo(currentIndex + 1)}
                                disabled={currentIndex === images.length - 1}
                                style={{
                                    position: 'absolute',
                                    right: 18,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 44,
                                    height: 44,
                                    borderRadius: 999,
                                    border: '1px solid rgba(242,217,162,0.16)',
                                    background: 'rgba(12,9,6,0.62)',
                                    color: '#fff7e8',
                                    opacity: currentIndex === images.length - 1 ? 0.3 : 1,
                                    zIndex: 4,
                                }}
                            >
                                ›
                            </button>
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 36,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    padding: '7px 14px',
                                    borderRadius: 999,
                                    background: 'rgba(12,9,6,0.62)',
                                    border: '1px solid rgba(242,217,162,0.16)',
                                    color: '#fff7e8',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    zIndex: 4,
                                }}
                            >
                                {currentIndex + 1} / {images.length}
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}
        </>
    );
}
