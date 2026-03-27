'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBooking, getManualPaymentMethods, getProperty, submitManualPayment } from '../../../lib/api';
import PriceDisplay from '../../../components/PriceDisplay';
import PaymentMethodLogo from '../../../components/PaymentMethodLogo';
import useTelegramBackButton from '../../../hooks/useTelegramBackButton';
import { copyText } from '../../../lib/clipboard';
import type { Booking, ManualPaymentMethod, PropertyDetail } from '../../../lib/types';
import { getTelegramWebApp, haptic } from '../../../lib/telegram';
import { useAuth } from '../../../context/AuthContext';
import { useAppPreferences } from '../../../context/AppPreferencesContext';
import { formatLocalizedDate, formatUnitCount } from '../../../lib/i18n';

const adminContact = {
    username: '@premiumhouse_admin',
    link: 'https://t.me/premiumhouse_admin',
};

function getRemainingMs(expiresAt: string | undefined | null, nowMs: number): number {
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

export default function BookingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { t, language } = useAppPreferences();
    const bookingId = params.id as string;

    const [booking, setBooking] = useState<Booking | null>(null);
    const [property, setProperty] = useState<PropertyDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [manualMethods, setManualMethods] = useState<ManualPaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [copiedCardNumber, setCopiedCardNumber] = useState(false);

    const handleBack = useCallback(() => {
        router.push('/bookings');
    }, [router]);

    const isTelegramBackVisible = useTelegramBackButton(handleBack);

    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

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

    useEffect(() => {
        if (!isAuthenticated) return;
        const loadMethods = async () => {
            try {
                const response = await getManualPaymentMethods();
                setManualMethods(response.items);
                setSelectedMethodId((current) => current || response.items[0]?.id || '');
            } catch (err) {
                console.error('Failed to load manual payment methods:', err);
            }
        };
        void loadMethods();
    }, [isAuthenticated]);

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

    const handleManualPayment = async () => {
        if (!booking) return;
        if (!selectedMethodId) return;
        if (remainingMs <= 0) {
            setError(t('bookings.expiredWindow'));
            return;
        }
        setIsSubmittingPayment(true);
        setError(null);
        try {
            const submission = await submitManualPayment(booking.id, selectedMethodId);
            setBooking((current) => current ? ({
                ...current,
                status: submission.booking_status,
                expires_at: submission.expires_at ?? current.expires_at,
            }) : current);
            haptic('medium');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('booking.continuePaymentError'));
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleCopyCardNumber = async (cardNumber: string) => {
        try {
            await copyText(cardNumber);
            setCopiedCardNumber(true);
            haptic('light');
            window.setTimeout(() => setCopiedCardNumber(false), 1400);
        } catch {
            setError(t('booking.cardNumberCopyFailed'));
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
                    onClick={handleBack}
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
                : booking.status === 'awaiting_confirmation' ? t('bookings.awaitingConfirmation')
                : booking.status === 'confirmed' ? t('bookings.confirmed')
                    : booking.status === 'completed' ? t('bookings.completed')
                        : booking.status === 'cancelled' ? t('bookings.cancelled')
                            : t('bookings.expired'),
        color:
            booking.status === 'confirmed'
                ? '#00b894'
                : booking.status === 'awaiting_confirmation'
                    ? 'var(--color-warning)'
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
                : booking.status === 'awaiting_confirmation'
                    ? 'rgba(210,174,104,0.14)'
                : booking.status === 'completed'
                    ? 'rgba(210,174,104,0.12)'
                    : booking.status === 'cancelled'
                        ? 'rgba(214,48,49,0.12)'
                        : booking.status === 'expired'
                            ? 'rgba(99,110,114,0.12)'
                            : 'rgba(210,174,104,0.14)',
    };
    const nightlyPrice = booking.price_per_night_snapshot || (booking.total_nights > 0 ? booking.total_price / booking.total_nights : booking.total_price);
    const remainingMs = ['pending_payment', 'awaiting_confirmation'].includes(booking.status) ? getRemainingMs(booking.expires_at, nowMs) : 0;
    const countdown = remainingMs > 0 ? formatCountdown(remainingMs) : '00:00';
    const countdownText = remainingMs > 0 ? formatCountdownText(remainingMs, t) : t('bookings.expiredWindow');
    const selectedMethod = manualMethods.find((item) => item.id === selectedMethodId) || null;

    return (
        <div style={{ minHeight: '100vh', padding: 'calc(16px + var(--tg-safe-top, 60px)) 16px 36px' }}>
            {!isTelegramBackVisible ? (
                <button
                    onClick={() => {
                        haptic('light');
                        handleBack();
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
            ) : null}

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

            {['pending_payment', 'awaiting_confirmation'].includes(booking.status) && (
                <div
                    style={{
                        padding: 18,
                        borderRadius: 20,
                        border: '1px solid rgba(210,174,104,0.22)',
                        background: 'rgba(210,174,104,0.1)',
                        marginBottom: 16,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>
                            {booking.status === 'awaiting_confirmation' ? t('bookings.awaitingConfirmation') : t('bookings.pendingPayment')}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: remainingMs > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                            {countdown}
                        </div>
                    </div>
                    <div style={{ fontSize: 13, color: remainingMs > 0 ? 'var(--color-brand-light)' : 'var(--color-danger)' }}>
                        {countdownText}
                    </div>
                </div>
            )}

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
                    {selectedMethod ? (
                        <div
                            style={{
                                padding: 14,
                                borderRadius: 16,
                                border: '1px solid rgba(242,217,162,0.12)',
                                background: 'rgba(12,9,6,0.56)',
                                marginBottom: 12,
                            }}
                        >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--color-brand-light)', textTransform: 'uppercase' }}>{selectedMethod.brand}</div>
                                        <div style={{ fontSize: 16, fontWeight: 800 }}>{selectedMethod.name}</div>
                                    </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PaymentMethodLogo brand={selectedMethod.brand} size="md" />
                                    <button
                                        type="button"
                                        onClick={() => void handleCopyCardNumber(selectedMethod.card_number)}
                                        aria-label={t('booking.copyCardNumber')}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 10,
                                            border: '1px solid rgba(242,217,162,0.16)',
                                            background: 'rgba(255,247,232,0.04)',
                                            color: 'var(--color-brand-light)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <rect x="9" y="9" width="10" height="10" rx="2" />
                                            <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                    <div style={{ fontSize: 12, color: 'var(--color-brand-light)' }}>{selectedMethod.card_number}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: selectedMethod.instructions ? 10 : 0 }}>{selectedMethod.card_holder}</div>
                            {selectedMethod.instructions ? <div style={{ fontSize: 12, color: 'var(--color-brand-light)', lineHeight: 1.5 }}>{selectedMethod.instructions}</div> : null}
                            {copiedCardNumber ? <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-brand-light)' }}>{t('booking.cardNumberCopied')}</div> : null}
                        </div>
                    ) : null}
                    <div style={{ display: 'grid', gap: 10 }}>
                        {manualMethods.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setSelectedMethodId(item.id);
                                    haptic('light');
                                }}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: item.id === selectedMethodId ? '1px solid rgba(242,217,162,0.32)' : '1px solid rgba(242,217,162,0.12)',
                                    background: item.id === selectedMethodId ? 'rgba(210,174,104,0.12)' : 'rgba(12,9,6,0.72)',
                                    color: '#fff7e8',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <PaymentMethodLogo brand={item.brand} size="md" />
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{item.name}</div>
                                        <div style={{ marginTop: 6, color: 'var(--color-muted)', fontSize: 12 }}>{item.card_number}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        <button
                            disabled={isSubmittingPayment || !selectedMethodId || remainingMs <= 0}
                            onClick={handleManualPayment}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                borderRadius: 14,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: 'var(--color-ink-soft)',
                                fontSize: 14,
                                fontWeight: 800,
                                cursor: isSubmittingPayment || !selectedMethodId || remainingMs <= 0 ? 'not-allowed' : 'pointer',
                                opacity: isSubmittingPayment || !selectedMethodId || remainingMs <= 0 ? 0.72 : 1,
                            }}
                        >
                            {isSubmittingPayment ? t('booking.submittingPayment') : t('booking.markAsPaid')}
                        </button>
                    </div>
                </div>
            )}

            {booking.status === 'awaiting_confirmation' && (
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
                        {t('bookings.awaitingConfirmation')}
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                        {t('bookings.awaitingConfirmationDescription')}
                    </p>
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

            {['pending_payment', 'awaiting_confirmation', 'confirmed'].includes(booking.status) && (
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
