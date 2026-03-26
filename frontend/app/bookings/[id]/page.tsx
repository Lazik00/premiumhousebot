'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPaymentLink, getBooking, getProperty } from '../../../lib/api';
import PriceDisplay from '../../../components/PriceDisplay';
import type { Booking, PropertyDetail } from '../../../lib/types';
import { getTelegramWebApp, haptic } from '../../../lib/telegram';
import { useAuth } from '../../../context/AuthContext';
import { useAppPreferences } from '../../../context/AppPreferencesContext';
import { formatLocalizedDate, formatUnitCount } from '../../../lib/i18n';

const adminContact = {
    username: '@premiumhouse_admin',
    link: 'https://t.me/premiumhouse_admin',
};

export default function BookingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { t, language } = useAppPreferences();
    const bookingId = params.id as string;

    const [booking, setBooking] = useState<Booking | null>(null);
    const [property, setProperty] = useState<PropertyDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!bookingId || !isAuthenticated) {
            if (!authLoading) setIsLoading(false);
            return;
        }

        const boot = async () => {
            setIsLoading(true);
            try {
                const bookingData = await getBooking(bookingId);
                setBooking(bookingData);
                const propertyData = await getProperty(bookingData.property_id);
                setProperty(propertyData);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : t('bookings.detailMissing'));
            } finally {
                setIsLoading(false);
            }
        };

        boot();
    }, [bookingId, isAuthenticated, authLoading, t]);

    const assignedGuests = useMemo(() => {
        if (!booking) return 0;
        return booking.guests_adults_men + booking.guests_adults_women + booking.guests_children;
    }, [booking]);

    const unknownGuests = useMemo(() => {
        if (!booking) return 0;
        return Math.max(booking.guests_total - assignedGuests, 0);
    }, [booking, assignedGuests]);

    const openAdminProfile = () => {
        haptic('medium');
        const tg = getTelegramWebApp();
        if (tg?.openTelegramLink) {
            tg.openTelegramLink(adminContact.link);
            return;
        }
        window.open(adminContact.link, '_blank', 'noopener,noreferrer');
    };

    const handlePayment = async (provider: 'click' | 'payme' | 'rahmat') => {
        if (!booking) return;
        setIsPaying(true);
        setError(null);
        try {
            const payment = await createPaymentLink(booking.id, provider);
            const tg = getTelegramWebApp();
            if (tg?.openLink) {
                tg.openLink(payment.payment_url);
            } else {
                window.open(payment.payment_url, '_blank', 'noopener,noreferrer');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('booking.continuePaymentError'));
        } finally {
            setIsPaying(false);
        }
    };

    if (!authLoading && !isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                    {t('bookings.loginRequiredTitle')}
                </h1>
                <p style={{ color: 'var(--color-muted)' }}>
                    {t('bookings.loginRequiredDescription')}
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div style={{ padding: 24 }}>
                <div className="skeleton" style={{ width: 180, height: 26, marginBottom: 14 }} />
                <div className="skeleton" style={{ width: '100%', height: 180, marginBottom: 14 }} />
                <div className="skeleton" style={{ width: '100%', height: 260 }} />
            </div>
        );
    }

    if (!booking) {
        return (
            <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
                <button
                    onClick={() => router.push('/bookings')}
                    style={{
                        marginBottom: 18,
                        border: 'none',
                        background: 'none',
                        color: 'var(--color-brand-light)',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                    }}
                >
                    {t('property.back')}
                </button>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                    {t('bookings.detailMissing')}
                </h1>
                <p style={{ color: 'var(--color-muted)' }}>{error || t('bookings.detailMissingDescription')}</p>
            </div>
        );
    }

    const status = {
        label:
            booking.status === 'pending_payment' ? t('bookings.pendingPayment')
                : booking.status === 'confirmed' ? t('bookings.confirmed')
                    : booking.status === 'completed' ? t('bookings.completed')
                        : booking.status === 'cancelled' ? t('bookings.cancelled')
                            : t('bookings.expired'),
        color:
            booking.status === 'confirmed'
                ? '#00b894'
                : booking.status === 'completed'
                    ? 'var(--color-brand)'
                    : booking.status === 'cancelled'
                        ? '#d63031'
                        : booking.status === 'expired'
                            ? '#636e72'
                            : 'var(--color-warning)',
        bg:
            booking.status === 'confirmed'
                ? 'rgba(0,184,148,0.12)'
                : booking.status === 'completed'
                    ? 'rgba(210,174,104,0.12)'
                    : booking.status === 'cancelled'
                        ? 'rgba(214,48,49,0.12)'
                        : booking.status === 'expired'
                            ? 'rgba(99,110,114,0.12)'
                            : 'rgba(210,174,104,0.14)',
    };
    const nightlyPrice = booking.price_per_night_snapshot || (booking.total_nights > 0 ? booking.total_price / booking.total_nights : booking.total_price);

    return (
        <div style={{ minHeight: '100vh', padding: 'calc(16px + var(--tg-safe-top, 60px)) 16px 36px' }}>
            <button
                onClick={() => {
                    haptic('light');
                    router.push('/bookings');
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    border: 'none',
                    background: 'none',
                    color: 'var(--color-brand-light)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: 16,
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                {t('bookings.detailBack')}
            </button>

            <div
                style={{
                    borderRadius: 24,
                    overflow: 'hidden',
                    border: '1px solid var(--color-line)',
                    background: 'var(--color-surface)',
                    marginBottom: 16,
                }}
            >
                <div
                    style={{
                        height: 190,
                        background: property?.cover_image
                            ? `linear-gradient(180deg, rgba(8,6,3,0.08) 0%, rgba(8,6,3,0.62) 100%), url(${property.cover_image}) center/cover`
                            : 'var(--gradient-brand)',
                    }}
                />
                <div style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div
                            style={{
                                padding: '6px 12px',
                                borderRadius: 999,
                                background: status.bg,
                                color: status.color,
                                fontSize: 12,
                                fontWeight: 800,
                            }}
                        >
                            {status.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                            #{booking.booking_code}
                        </div>
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, lineHeight: 1.05, marginBottom: 8 }}>
                        {property?.title || t('bookings.detailMissing')}
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                        {property ? `${property.city}, ${property.region}` : `Property ID: ${booking.property_id}`}
                    </p>
                </div>
            </div>

            <div
                style={{
                    padding: 18,
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(210,174,104,0.12) 100%)',
                    border: '1px solid var(--color-line)',
                    marginBottom: 16,
                }}
            >
                <div style={{ fontSize: 12, color: 'rgba(255,247,232,0.62)', marginBottom: 8 }}>{t('bookings.totalAmount')}</div>
                <PriceDisplay
                    amount={booking.total_price}
                    baseCurrency={property?.currency || 'UZS'}
                    primaryStyle={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800 }}
                    secondaryStyle={{ fontSize: 12, color: 'rgba(255,247,232,0.62)' }}
                    wrapperStyle={{ gap: 6, marginBottom: 8 }}
                />
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    {t('bookings.totalHint', { count: formatUnitCount(language, 'night', booking.total_nights) })}
                </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                {[
                    { label: t('bookings.dateIn'), value: formatLocalizedDate(booking.start_date, language, { day: 'numeric', month: 'long', year: 'numeric' }) },
                    { label: t('bookings.dateOut'), value: formatLocalizedDate(booking.end_date, language, { day: 'numeric', month: 'long', year: 'numeric' }) },
                    { label: t('bookings.nightlyRate'), value: null, amount: nightlyPrice },
                    { label: t('bookings.duration'), value: formatUnitCount(language, 'night', booking.total_nights) },
                    { label: t('booking.totalGuests'), value: formatUnitCount(language, 'guest', booking.guests_total) },
                    { label: t('bookings.enteredGuests'), value: formatUnitCount(language, 'guest', assignedGuests) },
                ].map((item) => (
                    <div
                        key={item.label}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '14px 16px',
                            borderRadius: 16,
                            border: '1px solid var(--color-line)',
                            background: 'var(--color-surface)',
                        }}
                    >
                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{item.label}</span>
                        {typeof item.amount === 'number' ? (
                            <PriceDisplay
                                amount={item.amount}
                                baseCurrency={property?.currency || 'UZS'}
                                primaryStyle={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}
                                secondaryStyle={{ fontSize: 11, color: 'var(--color-muted)' }}
                                align="right"
                            />
                        ) : (
                            <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{item.value}</span>
                        )}
                    </div>
                ))}
            </div>

            <div
                style={{
                    padding: 18,
                    borderRadius: 20,
                    border: '1px solid var(--color-line)',
                    background: 'var(--color-surface)',
                    marginBottom: 16,
                }}
            >
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                    {t('bookings.guestBreakdown')}
                </h2>
                <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{t('booking.men')}</span>
                        <strong>{booking.guests_adults_men}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{t('booking.women')}</span>
                        <strong>{booking.guests_adults_women}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{t('booking.children')}</span>
                        <strong>{booking.guests_children}</strong>
                    </div>
                    {unknownGuests > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{t('bookings.unknownGuests')}</span>
                            <strong>{unknownGuests}</strong>
                        </div>
                    )}
                </div>
            </div>

            {booking.status === 'pending_payment' && (
                <div
                    style={{
                        padding: 18,
                        borderRadius: 20,
                        border: '1px solid rgba(210,174,104,0.22)',
                        background: 'rgba(210,174,104,0.1)',
                        marginBottom: 16,
                    }}
                >
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                        {t('bookings.continuePayment')}
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
                        {t('bookings.continuePaymentDescription')}
                    </p>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {[
                            { provider: 'click' as const, label: t('bookings.payVia', { provider: 'Click' }) },
                            { provider: 'payme' as const, label: t('bookings.payVia', { provider: 'Payme' }) },
                            { provider: 'rahmat' as const, label: t('bookings.payVia', { provider: 'Rahmat' }) },
                        ].map((item) => (
                            <button
                                key={item.provider}
                                disabled={isPaying}
                                onClick={() => handlePayment(item.provider)}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(242,217,162,0.12)',
                                    background: 'rgba(12,9,6,0.72)',
                                    color: '#fff7e8',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: isPaying ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: 'rgba(214,48,49,0.08)',
                        color: 'var(--color-danger)',
                        marginBottom: 16,
                        fontSize: 13,
                    }}
                >
                    {error}
                </div>
            )}

            {['pending_payment', 'confirmed'].includes(booking.status) && (
                <div
                    style={{
                        padding: 18,
                        borderRadius: 20,
                        border: '1px solid var(--color-line)',
                        background: 'var(--color-surface)',
                    }}
                >
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                        {t('bookings.cancelBooking')}
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-muted)', marginBottom: 14 }}>
                        {t('bookings.cancelBookingDescription')}
                    </p>
                    <button
                        onClick={openAdminProfile}
                        style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: 14,
                            border: 'none',
                            background: 'var(--gradient-brand)',
                            color: 'var(--color-ink-soft)',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        {t('bookings.goToAdmin', { username: adminContact.username })}
                    </button>
                </div>
            )}
        </div>
    );
}
