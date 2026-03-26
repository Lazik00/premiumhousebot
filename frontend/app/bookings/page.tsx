'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMyBookings } from '../../lib/api';
import PriceDisplay from '../../components/PriceDisplay';
import { haptic } from '../../lib/telegram';
import { useAuth } from '../../context/AuthContext';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatLocalizedDate, formatUnitCount } from '../../lib/i18n';
import type { Booking } from '../../lib/types';
import { BookingCardSkeleton } from '../../components/LoadingSkeleton';
import BottomNav from '../../components/BottomNav';

function getRemainingMs(expiresAt: string | undefined, nowMs: number): number {
    if (!expiresAt) return 0;
    return Math.max(new Date(expiresAt).getTime() - nowMs, 0);
}

function formatCountdown(ms: number): string {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCountdownText(
    ms: number,
    t: (key: string, variables?: Record<string, string | number>) => string,
): string {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return t('bookings.expiresInHours', { hours, minutes, seconds });
    }
    if (minutes > 0) {
        return t('bookings.expiresInMinutes', { minutes, seconds });
    }
    return t('bookings.expiresInSeconds', { seconds });
}

const tabs = [
    { key: 'active', labelKey: 'bookings.active' },
    { key: 'past', labelKey: 'bookings.past' },
    { key: 'all', labelKey: 'bookings.all' },
];

export default function BookingsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { t, language } = useAppPreferences();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active');
    const [nowMs, setNowMs] = useState(() => Date.now());

    const fetchBookings = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getMyBookings(50, 0);
            setBookings(res.items);
        } catch (err) {
            console.error('Failed to fetch bookings:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            fetchBookings();
        } else if (!authLoading && !isAuthenticated) {
            setIsLoading(false);
        }
    }, [authLoading, isAuthenticated, fetchBookings]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    const filteredBookings = bookings.filter((booking) => {
        if (activeTab === 'active') return ['pending_payment', 'confirmed'].includes(booking.status);
        if (activeTab === 'past') return ['completed', 'cancelled', 'expired'].includes(booking.status);
        return true;
    });

    if (!authLoading && !isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh' }}>
                <div style={{ padding: 'calc(60px + var(--tg-safe-top, 60px)) 20px 60px', textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🔐</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                        {t('bookings.loginRequiredTitle')}
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                        {t('bookings.loginRequiredDescription')}
                    </p>
                </div>
                <BottomNav />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            <div style={{ padding: 'calc(20px + var(--tg-safe-top, 60px)) 16px 0' }}>
                <h1
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 26,
                        fontWeight: 800,
                        marginBottom: 16,
                    }}
                >
                    {t('bookings.title')}
                </h1>

                <div
                    style={{
                        display: 'flex',
                        gap: 4,
                        padding: 4,
                        borderRadius: 14,
                        background: 'var(--color-surface)',
                        marginBottom: 20,
                    }}
                >
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); haptic('light'); }}
                            style={{
                                flex: 1,
                                padding: '10px 0',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === tab.key ? 'var(--gradient-brand)' : 'transparent',
                                color: activeTab === tab.key ? 'var(--color-ink-soft)' : 'var(--color-muted)',
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isLoading ? (
                    <>
                        <BookingCardSkeleton />
                        <BookingCardSkeleton />
                        <BookingCardSkeleton />
                    </>
                ) : filteredBookings.length > 0 ? (
                    filteredBookings.map((booking, index) => {
                        const statusLabelMap: Record<string, string> = {
                            pending_payment: t('bookings.pendingPayment'),
                            confirmed: t('bookings.confirmed'),
                            completed: t('bookings.completed'),
                            cancelled: t('bookings.cancelled'),
                            expired: t('bookings.expired'),
                        };
                        const status = {
                            label: statusLabelMap[booking.status] || t('bookings.expired'),
                            color: booking.status === 'confirmed'
                                ? '#00b894'
                                : booking.status === 'completed'
                                    ? 'var(--color-brand)'
                                    : booking.status === 'cancelled'
                                        ? '#d63031'
                                        : booking.status === 'expired'
                                            ? '#636e72'
                                            : 'var(--color-warning)',
                            bg: booking.status === 'confirmed'
                                ? 'rgba(0,184,148,0.12)'
                                : booking.status === 'completed'
                                    ? 'rgba(210,174,104,0.12)'
                                    : booking.status === 'cancelled'
                                        ? 'rgba(214,48,49,0.12)'
                                        : booking.status === 'expired'
                                            ? 'rgba(99,110,114,0.12)'
                                            : 'rgba(210,174,104,0.14)',
                            emoji: booking.status === 'confirmed'
                                ? '✅'
                                : booking.status === 'completed'
                                    ? '🏁'
                                    : booking.status === 'cancelled'
                                        ? '❌'
                                        : booking.status === 'expired'
                                            ? '⌛'
                                            : '⏳',
                        };
                        const remainingMs = booking.status === 'pending_payment' ? getRemainingMs(booking.expires_at, nowMs) : 0;
                        const countdown = remainingMs > 0 ? formatCountdown(remainingMs) : null;
                        const countdownText = remainingMs > 0 ? formatCountdownText(remainingMs, t) : t('bookings.expiredWindow');
                        const helperText = booking.status === 'pending_payment'
                            ? countdownText
                            : booking.status === 'confirmed'
                                ? t('bookings.detailHintConfirmed')
                                : t('bookings.detailHint');

                        return (
                            <div key={booking.id} className="slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                                <div
                                    onClick={() => {
                                        haptic('light');
                                        router.push(`/bookings/${booking.id}`);
                                    }}
                                    style={{
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        background: 'var(--color-surface)',
                                        border: '1px solid var(--color-line)',
                                        padding: 16,
                                        cursor: 'pointer',
                                    }}
                                    className="hover-lift"
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <div
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: 8,
                                                    background: status.bg,
                                                    color: status.color,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                <span>{status.emoji}</span>
                                                <span>{status.label}</span>
                                            </div>
                                            {booking.status === 'pending_payment' && (
                                                <div
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: 999,
                                                        background: remainingMs > 0 ? 'rgba(255,247,232,0.06)' : 'rgba(214,48,49,0.12)',
                                                        border: `1px solid ${remainingMs > 0 ? 'rgba(242,217,162,0.14)' : 'rgba(214,48,49,0.2)'}`,
                                                        color: remainingMs > 0 ? '#fff7e8' : 'var(--color-danger)',
                                                        fontSize: 12,
                                                        fontWeight: 800,
                                                        fontFamily: 'monospace',
                                                        letterSpacing: '0.04em',
                                                    }}
                                                >
                                                    {remainingMs > 0 ? countdown : '00:00'}
                                                </div>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                                            #{booking.booking_code}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            marginBottom: 12,
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            background: 'rgba(210, 174, 104, 0.08)',
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>{t('bookings.checkIn')}</div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                                                {formatLocalizedDate(booking.start_date, language, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <div style={{ color: 'var(--color-muted)' }}>→</div>
                                        <div style={{ flex: 1, textAlign: 'right' }}>
                                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>{t('bookings.checkOut')}</div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                                                {formatLocalizedDate(booking.end_date, language, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                                            {formatUnitCount(language, 'night', booking.total_nights)} • {formatUnitCount(language, 'guest', booking.guests_total)}
                                        </div>
                                        <PriceDisplay
                                            amount={booking.total_price}
                                            primaryStyle={{ fontSize: 16, fontWeight: 700 }}
                                            secondaryStyle={{ fontSize: 11, color: 'var(--color-muted)' }}
                                            align="right"
                                        />
                                    </div>

                                    <div
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 12,
                                            background: booking.status === 'pending_payment'
                                                ? 'rgba(210,174,104,0.14)'
                                                : 'rgba(210,174,104,0.08)',
                                            color: booking.status === 'pending_payment' ? 'var(--color-warning)' : 'var(--color-brand-light)',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        {booking.status === 'pending_payment' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span>{t('bookings.payInside')}</span>
                                                <span style={{ color: remainingMs > 0 ? 'var(--color-brand-light)' : 'var(--color-danger)' }}>
                                                    {helperText}
                                                </span>
                                            </div>
                                        ) : (
                                            helperText
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div
                        className="fade-in"
                        style={{
                            textAlign: 'center',
                            padding: '48px 20px',
                            color: 'var(--color-muted)',
                        }}
                    >
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                            {t('bookings.noBookingsTitle')}
                        </h3>
                        <p style={{ fontSize: 14, marginBottom: 20 }}>
                            {activeTab === 'active' ? t('bookings.noBookingsDescription') : t('bookings.noBookingsDescription')}
                        </p>
                        <button
                            onClick={() => { haptic('light'); router.push('/'); }}
                            style={{
                                padding: '12px 24px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: 'var(--color-ink-soft)',
                                fontSize: 14,
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {t('booking.browseHomes')}
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
