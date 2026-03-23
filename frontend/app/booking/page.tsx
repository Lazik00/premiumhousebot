'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBooking, createPaymentLink, getProperty } from '../../lib/api';
import type { PropertyDetail } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { getTelegramWebApp, haptic } from '../../lib/telegram';

function formatPrice(price: number, currency: string): string {
    if (currency === 'UZS') {
        return `${new Intl.NumberFormat('uz-UZ').format(price)} so'm`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

function CounterRow({
    label,
    description,
    value,
    min = 0,
    max,
    onChange,
}: {
    label: string;
    description: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (nextValue: number) => void;
}) {
    const decrementDisabled = value <= min;
    const incrementDisabled = max !== undefined && value >= max;

    const buttonStyle = (disabled: boolean, filled = false): React.CSSProperties => ({
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: filled ? 'none' : '1px solid var(--color-brand)',
        background: disabled ? 'var(--color-line)' : filled ? 'var(--color-brand)' : 'transparent',
        color: disabled ? 'var(--color-muted)' : filled ? '#fff' : 'var(--color-brand)',
        fontSize: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
    });

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid var(--color-line)',
            }}
        >
            <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{description}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                    type="button"
                    disabled={decrementDisabled}
                    onClick={() => {
                        if (decrementDisabled) return;
                        haptic('light');
                        onChange(value - 1);
                    }}
                    style={buttonStyle(decrementDisabled)}
                >
                    -
                </button>
                <span style={{ minWidth: 20, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{value}</span>
                <button
                    type="button"
                    disabled={incrementDisabled}
                    onClick={() => {
                        if (incrementDisabled) return;
                        haptic('light');
                        onChange(value + 1);
                    }}
                    style={buttonStyle(incrementDisabled, true)}
                >
                    +
                </button>
            </div>
        </div>
    );
}

function BookingContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const propertyId = searchParams.get('property');
    const policyContentRef = useRef<HTMLDivElement | null>(null);

    const [property, setProperty] = useState<PropertyDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [step, setStep] = useState(1);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [totalGuests, setTotalGuests] = useState(1);
    const [guestsMen, setGuestsMen] = useState(1);
    const [guestsWomen, setGuestsWomen] = useState(0);
    const [guestsChildren, setGuestsChildren] = useState(0);

    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

    const [isBooking, setIsBooking] = useState(false);
    const [bookingResult, setBookingResult] = useState<{ id: string; code: string; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!propertyId) {
            setIsLoading(false);
            return;
        }

        getProperty(propertyId)
            .then(setProperty)
            .catch(() => setError('Uy topilmadi'))
            .finally(() => setIsLoading(false));
    }, [propertyId]);

    useEffect(() => {
        setAcceptedPrivacy(false);
        setHasReadPrivacy(false);
    }, [startDate, endDate, totalGuests, guestsMen, guestsWomen, guestsChildren]);

    useEffect(() => {
        if (!showPrivacyModal) return;

        const node = policyContentRef.current;
        if (!node) return;

        const isShortContent = node.scrollHeight <= node.clientHeight + 12;
        if (isShortContent) {
            setHasReadPrivacy(true);
        }
    }, [showPrivacyModal]);

    const today = new Date().toISOString().split('T')[0];

    const totalNights = useMemo(() => {
        if (!startDate || !endDate) return 0;
        return Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
    }, [startDate, endDate]);

    const nightlyRate = Number(property?.price_per_night ?? 0);
    const estimatedTotal = totalNights * nightlyRate;
    const assignedGuests = guestsMen + guestsWomen + guestsChildren;
    const remainingGuests = totalGuests - assignedGuests;
    const hasAdultGuest = guestsMen + guestsWomen > 0;
    const guestBreakdownValid = assignedGuests <= totalGuests && assignedGuests > 0 && hasAdultGuest;
    const maxGuests = property?.capacity ?? 20;

    const progressLabel = `${step} / 3 Qadam`;

    const handlePolicyScroll = () => {
        const node = policyContentRef.current;
        if (!node) return;
        if (node.scrollTop + node.clientHeight >= node.scrollHeight - 12) {
            setHasReadPrivacy(true);
        }
    };

    const openPrivacyModal = () => {
        if (!guestBreakdownValid) return;
        haptic('medium');
        setShowPrivacyModal(true);
    };

    const closePrivacyModal = () => {
        haptic('light');
        setShowPrivacyModal(false);
    };

    const handleBooking = async () => {
        if (!property || !propertyId || !startDate || !endDate || totalNights <= 0) return;
        if (!guestBreakdownValid || !acceptedPrivacy) return;
        if (!isAuthenticated) {
            setError('Bron qilish uchun Telegram orqali tizimga kirish kerak');
            return;
        }

        setIsBooking(true);
        setError(null);
        haptic('heavy');

        try {
            const booking = await createBooking(
                propertyId,
                startDate,
                endDate,
                totalGuests,
                guestsMen,
                guestsWomen,
                guestsChildren,
            );

            setBookingResult({
                id: booking.id,
                code: booking.booking_code,
                total: booking.total_price,
            });
            setShowPrivacyModal(false);
            haptic('medium');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Bron yaratishda xatolik yuz berdi');
        } finally {
            setIsBooking(false);
        }
    };

    const handlePayment = async (provider: 'click' | 'payme' | 'rahmat') => {
        if (!bookingResult) return;

        haptic('medium');
        try {
            const payment = await createPaymentLink(bookingResult.id, provider);
            const tg = getTelegramWebApp();
            if (tg?.openLink) {
                tg.openLink(payment.payment_url);
                return;
            }
            window.open(payment.payment_url, '_blank', 'noopener,noreferrer');
        } catch {
            setError("To'lov havolasi yaratilmadi");
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: 32 }}>
                <div className="skeleton" style={{ width: 180, height: 28, marginBottom: 14 }} />
                <div className="skeleton" style={{ width: '100%', height: 110, marginBottom: 14 }} />
                <div className="skeleton" style={{ width: '100%', height: 280 }} />
            </div>
        );
    }

    if (!propertyId || !property) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 46, marginBottom: 14 }}>🏠</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                    Uy topilmadi
                </h2>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 18 }}>
                    Bron qilish uchun avval uy tanlang.
                </p>
                <button
                    onClick={() => router.push('/')}
                    style={{
                        padding: '12px 22px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'var(--gradient-brand)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                    }}
                >
                    Uylarni ko'rish
                </button>
            </div>
        );
    }

    if (bookingResult) {
        return (
            <div style={{ minHeight: '100vh', padding: '40px 16px', textAlign: 'center' }}>
                <div
                    style={{
                        width: 84,
                        height: 84,
                        borderRadius: 22,
                        margin: '0 auto 20px',
                        background: 'rgba(0, 184, 148, 0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 40,
                    }}
                >
                    ✓
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                    Bron yaratildi
                </h2>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 4 }}>
                    Bron kodi: <strong style={{ color: 'var(--color-text)' }}>#{bookingResult.code}</strong>
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 22 }}>
                    <span className="text-gradient">{formatPrice(bookingResult.total, property.currency)}</span>
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22, textAlign: 'left' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                        To'lov usulini tanlang
                    </h3>
                    {[
                        { provider: 'click' as const, name: 'Click', badge: 'CL' },
                        { provider: 'payme' as const, name: 'Payme', badge: 'PM' },
                        { provider: 'rahmat' as const, name: 'Rahmat', badge: 'RH' },
                    ].map((item) => (
                        <button
                            key={item.provider}
                            onClick={() => handlePayment(item.provider)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '14px 16px',
                                borderRadius: 14,
                                border: '1px solid var(--color-line)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                                fontSize: 14,
                                fontWeight: 700,
                            }}
                        >
                            <span
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    background: 'rgba(108, 92, 231, 0.12)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--color-brand)',
                                    fontSize: 12,
                                }}
                            >
                                {item.badge}
                            </span>
                            {item.name} orqali to'lash
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => router.push('/bookings')}
                    style={{
                        padding: '12px 22px',
                        borderRadius: 12,
                        border: '1px solid var(--color-line)',
                        background: 'transparent',
                        color: 'var(--color-muted)',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                    }}
                >
                    Buyurtmalarimga o'tish
                </button>
            </div>
        );
    }

    return (
        <>
            <div style={{ minHeight: '100vh', paddingBottom: 28 }}>
                <div style={{ padding: 'calc(16px + var(--tg-safe-top, 60px)) 16px 0' }}>
                    <button
                        onClick={() => {
                            haptic('light');
                            if (step > 1) {
                                setStep((currentStep) => currentStep - 1);
                                return;
                            }
                            router.back();
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: 0,
                            marginBottom: 16,
                            border: 'none',
                            background: 'none',
                            color: 'var(--color-brand-light)',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 700,
                            fontFamily: 'var(--font-body)',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Orqaga
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: 0 }}>
                            Bron qilish
                        </h1>
                        <div
                            style={{
                                padding: '5px 10px',
                                borderRadius: 999,
                                background: 'rgba(108, 92, 231, 0.1)',
                                color: 'var(--color-brand)',
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            {progressLabel}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        margin: '0 16px 18px',
                        padding: 14,
                        borderRadius: 18,
                        border: '1px solid var(--color-line)',
                        background: 'var(--color-surface)',
                        display: 'flex',
                        gap: 14,
                    }}
                >
                    <div
                        style={{
                            width: 78,
                            height: 78,
                            flexShrink: 0,
                            borderRadius: 14,
                            background: property.cover_image
                                ? `url(${property.cover_image}) center/cover`
                                : 'var(--gradient-brand)',
                        }}
                    />
                    <div style={{ minWidth: 0 }}>
                        <h2
                            className="line-clamp-2"
                            style={{ fontSize: 15, lineHeight: 1.25, fontWeight: 700, marginBottom: 6 }}
                        >
                            {property.title}
                        </h2>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
                            {property.city}, {property.region}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>
                            <span className="text-gradient">{formatPrice(property.price_per_night, property.currency)}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}> / kecha</span>
                        </div>
                    </div>
                </div>

                {step === 1 && (
                    <div style={{ padding: '0 16px' }}>
                        <div
                            style={{
                                padding: 18,
                                borderRadius: 18,
                                border: '1px solid var(--color-line)',
                                background: 'var(--color-surface)',
                                marginBottom: 18,
                            }}
                        >
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
                                1. Sanalarni tanlang
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6 }}>
                                        Kirish sanasi
                                    </label>
                                    <input
                                        type="date"
                                        min={today}
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: 14,
                                            border: '1px solid var(--color-line)',
                                            background: 'var(--color-canvas)',
                                            color: 'var(--color-text)',
                                            fontSize: 14,
                                            fontFamily: 'var(--font-body)',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 6 }}>
                                        Chiqish sanasi
                                    </label>
                                    <input
                                        type="date"
                                        min={startDate || today}
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: 14,
                                            border: '1px solid var(--color-line)',
                                            background: 'var(--color-canvas)',
                                            color: 'var(--color-text)',
                                            fontSize: 14,
                                            fontFamily: 'var(--font-body)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div
                                style={{
                                    marginTop: 14,
                                    padding: '14px 16px',
                                    borderRadius: 16,
                                    background: 'rgba(108, 92, 231, 0.08)',
                                    color: totalNights > 0 ? 'var(--color-text)' : 'var(--color-muted)',
                                    fontSize: 13,
                                }}
                            >
                                {totalNights > 0 ? `${formatPrice(nightlyRate, property.currency)} x ${totalNights} kecha = ${formatPrice(estimatedTotal, property.currency)}` : 'Sanalarni tanlang'}
                            </div>
                        </div>

                        <div
                            style={{
                                padding: '18px 18px 16px',
                                borderRadius: 20,
                                border: '1px solid var(--color-line)',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(108,92,231,0.12) 100%)',
                            }}
                        >
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginBottom: 6 }}>
                                Tanlangan sanalar bo'yicha summa
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
                                {formatPrice(estimatedTotal, property.currency)}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
                                Narx faqat kecha soniga qarab hisoblanadi.
                            </div>
                            <button
                                type="button"
                                disabled={totalNights <= 0}
                                onClick={() => {
                                    haptic('medium');
                                    setStep(2);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '16px 0',
                                    borderRadius: 14,
                                    border: 'none',
                                    background: totalNights > 0 ? 'var(--gradient-brand)' : 'var(--color-surface)',
                                    color: totalNights > 0 ? '#fff' : 'var(--color-muted)',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    cursor: totalNights > 0 ? 'pointer' : 'not-allowed',
                                    fontFamily: 'var(--font-body)',
                                }}
                            >
                                Mehmonlar soniga o'tish
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ padding: '0 16px' }}>
                        <div
                            style={{
                                padding: 18,
                                borderRadius: 18,
                                border: '1px solid var(--color-line)',
                                background: 'var(--color-surface)',
                                marginBottom: 18,
                            }}
                        >
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
                                2. Necha kishilik bron
                            </h2>
                            <CounterRow
                                label="Jami mehmon"
                                description={`Uy sig'imi: ${maxGuests} kishi`}
                                value={totalGuests}
                                min={1}
                                max={maxGuests}
                                onChange={setTotalGuests}
                            />
                            <div style={{ paddingTop: 14, fontSize: 13, color: 'var(--color-muted)' }}>
                                Keyingi qadamda erkaklar, ayollar va bolalar sonini alohida kiritasiz.
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                haptic('medium');
                                setStep(3);
                            }}
                            style={{
                                width: '100%',
                                padding: '16px 0',
                                borderRadius: 14,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: '#fff',
                                fontSize: 15,
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            Tarkibni kiritish
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div style={{ padding: '0 16px' }}>
                        <div
                            style={{
                                padding: 18,
                                borderRadius: 18,
                                border: '1px solid var(--color-line)',
                                background: 'var(--color-surface)',
                                marginBottom: 14,
                            }}
                        >
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                                3. Mehmonlar tarkibi
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>
                                Jami {totalGuests} kishi bron qilinadi. Tarkib to'liq bo'lmasa ham davom etishingiz mumkin.
                            </p>

                            <CounterRow
                                label="Erkaklar"
                                description="18 yoshdan katta"
                                value={guestsMen}
                                max={guestsMen + Math.max(remainingGuests, 0)}
                                onChange={setGuestsMen}
                            />
                            <CounterRow
                                label="Ayollar"
                                description="18 yoshdan katta"
                                value={guestsWomen}
                                max={guestsWomen + Math.max(remainingGuests, 0)}
                                onChange={setGuestsWomen}
                            />
                            <div style={{ borderBottom: '1px solid var(--color-line)' }}>
                                <CounterRow
                                    label="Bolalar"
                                    description="17 yoshgacha"
                                    value={guestsChildren}
                                    max={guestsChildren + Math.max(remainingGuests, 0)}
                                    onChange={setGuestsChildren}
                                />
                            </div>

                            <div
                                style={{
                                    marginTop: 14,
                                    padding: '12px 14px',
                                    borderRadius: 14,
                                    background: guestBreakdownValid ? 'rgba(0, 184, 148, 0.12)' : 'rgba(214, 48, 49, 0.08)',
                                    color: guestBreakdownValid ? '#00b894' : 'var(--color-danger)',
                                    fontSize: 13,
                                    fontWeight: 700,
                                }}
                            >
                                {assignedGuests > totalGuests
                                    ? `${assignedGuests - totalGuests} ta mehmon ortiqcha kiritildi`
                                    : hasAdultGuest
                                        ? remainingGuests > 0
                                            ? `${remainingGuests} ta mehmon umumiy mehmon sifatida saqlanadi`
                                            : 'Mehmonlar tarkibi tayyor'
                                        : 'Kamida 1 nafar katta yoshli mehmon bo\'lishi kerak'}
                            </div>
                        </div>

                        <div
                            style={{
                                padding: '16px 18px',
                                borderRadius: 18,
                                border: '1px solid var(--color-line)',
                                background: 'var(--gradient-card)',
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>Bir kecha narxi</span>
                                <span style={{ fontWeight: 700 }}>{formatPrice(nightlyRate, property.currency)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>Muddati</span>
                                <span style={{ fontWeight: 700 }}>{totalNights} kecha</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>Jami mehmon</span>
                                <span style={{ fontWeight: 700 }}>{totalGuests} kishi</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>Kiritilgan tarkib</span>
                                <span style={{ fontWeight: 700 }}>{assignedGuests} kishi</span>
                            </div>
                            {remainingGuests > 0 && (
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
                                    Qolgan {remainingGuests} kishi faqat umumiy mehmon soni sifatida saqlanadi. Narx o'zgarmaydi.
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                <span style={{ color: 'var(--color-muted)' }}>{`${formatPrice(nightlyRate, property.currency)} x ${totalNights}`}</span>
                                <span className="text-gradient" style={{ fontWeight: 800 }}>
                                    {formatPrice(estimatedTotal, property.currency)}
                                </span>
                            </div>
                        </div>

                        {acceptedPrivacy && (
                            <div
                                style={{
                                    marginBottom: 14,
                                    padding: '12px 14px',
                                    borderRadius: 14,
                                    background: 'rgba(0, 184, 148, 0.12)',
                                    color: '#00b894',
                                    fontSize: 13,
                                    fontWeight: 700,
                                }}
                            >
                                Maxfiylik siyosati qabul qilingan. Endi bron qilishingiz mumkin.
                            </div>
                        )}

                        {error && (
                            <div
                                style={{
                                    marginBottom: 14,
                                    padding: '12px 14px',
                                    borderRadius: 14,
                                    background: 'rgba(214, 48, 49, 0.08)',
                                    color: 'var(--color-danger)',
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    wordBreak: 'break-word',
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={!guestBreakdownValid}
                            onClick={openPrivacyModal}
                            style={{
                                width: '100%',
                                padding: '16px 0',
                                borderRadius: 14,
                                border: 'none',
                                background: guestBreakdownValid ? 'var(--gradient-brand)' : 'var(--color-surface)',
                                color: guestBreakdownValid ? '#fff' : 'var(--color-muted)',
                                fontSize: 15,
                                fontWeight: 800,
                                cursor: guestBreakdownValid ? 'pointer' : 'not-allowed',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {acceptedPrivacy ? 'Maxfiylik siyosatini qayta ko\'rish' : 'Maxfiylik siyosatini ochish'}
                        </button>
                    </div>
                )}
            </div>

            {showPrivacyModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 100,
                        background: 'rgba(8, 10, 16, 0.76)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: '24px 12px 0',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 480,
                            maxHeight: '88vh',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            background: '#11141c',
                            border: '1px solid rgba(255,255,255,0.06)',
                            boxShadow: '0 -18px 40px rgba(0,0,0,0.35)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '18px 18px 12px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <div>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                                    Maxfiylik siyosati
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>
                                    Pastgacha o'qib, keyin qabul qiling
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closePrivacyModal}
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: 18,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div
                            ref={policyContentRef}
                            onScroll={handlePolicyScroll}
                            style={{
                                maxHeight: '46vh',
                                overflowY: 'auto',
                                padding: '18px',
                                fontSize: 13,
                                lineHeight: 1.7,
                                color: 'rgba(255,255,255,0.76)',
                            }}
                        >
                            <p>
                                Premium House orqali bron qilishda siz yuborgan ism, Telegram akkaunt ma'lumotlari, bron sanalari va mehmonlar tarkibi
                                faqat buyurtmani bajarish, xavfsizlikni ta'minlash va zarur hollarda admin bilan aloqa qilish uchun ishlatiladi.
                            </p>
                            <p>
                                Platforma ma'lumotlarni uchinchi shaxslarga sotmaydi. To'lovlar tasdiqlangan provayderlar orqali amalga oshiriladi va bron
                                tasdiqlanishi uchun zarur texnik ma'lumotlar to'lov tizimi bilan almashiladi.
                            </p>
                            <p>
                                Agar bron bekor qilinishi kerak bo'lsa, Premium House admini siz bilan Telegram orqali bog'lanadi yoki siz admin profiliga
                                murojaat qilishingiz mumkin. Noto'g'ri yoki yashirilgan mehmon ma'lumotlari bronning bekor qilinishiga sabab bo'lishi mumkin.
                            </p>
                            <p>
                                Ushbu siyosatni qabul qilish orqali siz kiritgan ma'lumotlar buyurtma, xavfsizlik va qo'llab-quvvatlash maqsadlarida qayta
                                ishlanishiga rozilik bildirasiz. Bron yuborish tugmasi faqat siyosat bilan tanishib chiqilgandan keyin faollashadi.
                            </p>
                            <p>
                                Agar mazkur shartlarga rozi bo'lmasangiz, bronni yakunlamang. Savollar bo'lsa, Premium House adminiga Telegram orqali yozing.
                            </p>
                        </div>

                        <div style={{ padding: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '12px 14px',
                                    borderRadius: 14,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    marginBottom: 14,
                                    opacity: hasReadPrivacy ? 1 : 0.65,
                                    cursor: hasReadPrivacy ? 'pointer' : 'not-allowed',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={acceptedPrivacy}
                                    disabled={!hasReadPrivacy}
                                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                                    style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--color-brand)' }}
                                />
                                <span style={{ fontSize: 13, lineHeight: 1.5, color: '#fff' }}>
                                    Men maxfiylik siyosatini o'qib chiqdim va shartlarini qabul qilaman.
                                </span>
                            </label>

                            {!hasReadPrivacy && (
                                <div style={{ fontSize: 12, color: '#f8c291', marginBottom: 12 }}>
                                    Bron qilishdan oldin matnni pastgacha o'qib chiqing.
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={!acceptedPrivacy || isBooking}
                                onClick={handleBooking}
                                style={{
                                    width: '100%',
                                    padding: '15px 0',
                                    borderRadius: 14,
                                    border: 'none',
                                    background: acceptedPrivacy && !isBooking ? 'var(--gradient-brand)' : 'rgba(255,255,255,0.08)',
                                    color: acceptedPrivacy && !isBooking ? '#fff' : 'rgba(255,255,255,0.45)',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    cursor: acceptedPrivacy && !isBooking ? 'pointer' : 'not-allowed',
                                    fontFamily: 'var(--font-body)',
                                }}
                            >
                                {isBooking ? 'Bron yaratilmoqda...' : 'Bron qilish'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function BookingPage() {
    return (
        <Suspense fallback={<div style={{ padding: 32 }}>Yuklanmoqda...</div>}>
            <BookingContent />
        </Suspense>
    );
}
