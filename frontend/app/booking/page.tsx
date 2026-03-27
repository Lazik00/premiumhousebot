'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBooking, createPaymentLink, getProperty, getPropertyAvailability } from '../../lib/api';
import BookingAvailabilityCalendar from '../../components/BookingAvailabilityCalendar';
import PriceDisplay from '../../components/PriceDisplay';
import type { BlockedRange, PropertyDetail } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import useTelegramBackButton from '../../hooks/useTelegramBackButton';
import { formatUnitCount } from '../../lib/i18n';
import { getTelegramWebApp, haptic } from '../../lib/telegram';

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
        color: disabled ? 'var(--color-muted)' : filled ? 'var(--color-ink-soft)' : 'var(--color-brand)',
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
    const { t, language } = useAppPreferences();
    const propertyId = searchParams.get('property');
    const policyContentRef = useRef<HTMLDivElement | null>(null);

    const [property, setProperty] = useState<PropertyDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);

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

    const handleBack = useCallback(() => {
        if (step > 1) {
            setStep((currentStep) => currentStep - 1);
            return;
        }
        router.back();
    }, [router, step]);

    const isTelegramBackVisible = useTelegramBackButton(handleBack);
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!propertyId) {
            setIsLoading(false);
            setIsAvailabilityLoading(false);
            return;
        }

        const fromDate = today;
        const toDateObject = new Date();
        toDateObject.setMonth(toDateObject.getMonth() + 12);
        const toDate = toDateObject.toISOString().split('T')[0];

        Promise.all([
            getProperty(propertyId),
            getPropertyAvailability(propertyId, fromDate, toDate),
        ])
            .then(([propertyResponse, availabilityResponse]) => {
                setProperty(propertyResponse);
                setBlockedRanges(availabilityResponse.blocked_ranges);
            })
            .catch(() => setError(t('property.notFound')))
            .finally(() => {
                setIsLoading(false);
                setIsAvailabilityLoading(false);
            });
    }, [propertyId, t]);

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
    const privacyParagraphs = {
        uz: [
            "Premium House orqali bron qilishda siz yuborgan ism, Telegram akkaunt ma'lumotlari, bron sanalari va mehmonlar tarkibi faqat buyurtmani bajarish, xavfsizlikni ta'minlash va zarur hollarda admin bilan aloqa qilish uchun ishlatiladi.",
            "Platforma ma'lumotlarni uchinchi shaxslarga sotmaydi. To'lovlar tasdiqlangan provayderlar orqali amalga oshiriladi va bron tasdiqlanishi uchun zarur texnik ma'lumotlar to'lov tizimi bilan almashiladi.",
            "Agar bron bekor qilinishi kerak bo'lsa, Premium House admini siz bilan Telegram orqali bog'lanadi yoki siz admin profiliga murojaat qilishingiz mumkin. Noto'g'ri yoki yashirilgan mehmon ma'lumotlari bronning bekor qilinishiga sabab bo'lishi mumkin.",
            "Ushbu siyosatni qabul qilish orqali siz kiritgan ma'lumotlar buyurtma, xavfsizlik va qo'llab-quvvatlash maqsadlarida qayta ishlanishiga rozilik bildirasiz. Bron yuborish tugmasi faqat siyosat bilan tanishib chiqilgandan keyin faollashadi.",
            "Agar mazkur shartlarga rozi bo'lmasangiz, bronni yakunlamang. Savollar bo'lsa, Premium House adminiga Telegram orqali yozing.",
        ],
        ru: [
            "При бронировании через Premium House ваши имя, данные Telegram-аккаунта, даты брони и состав гостей используются только для исполнения заказа, обеспечения безопасности и связи с администратором при необходимости.",
            "Платформа не продаёт данные третьим лицам. Оплаты проходят через подтверждённых провайдеров, а технические сведения, необходимые для подтверждения брони, передаются платёжной системе.",
            "Если бронь нужно отменить, администратор Premium House свяжется с вами через Telegram или вы сможете написать ему напрямую. Неверные или скрытые данные о гостях могут стать причиной отмены брони.",
            "Принимая эту политику, вы соглашаетесь на обработку введённых данных для целей бронирования, безопасности и поддержки. Кнопка отправки брони становится активной только после ознакомления с политикой.",
            "Если вы не согласны с этими условиями, не завершайте бронирование. По вопросам можно написать администратору Premium House в Telegram.",
        ],
        en: [
            "When booking through Premium House, your name, Telegram account details, booking dates, and guest breakdown are used only to fulfill the order, maintain safety, and contact the admin when needed.",
            "The platform does not sell data to third parties. Payments are processed by approved providers, and the technical details required to confirm the booking are shared with the payment system.",
            "If the booking needs to be cancelled, the Premium House admin will contact you via Telegram, or you may contact the admin profile directly. Incorrect or hidden guest information may result in cancellation.",
            "By accepting this policy, you agree that the information you submit may be processed for booking, safety, and support purposes. The booking button becomes active only after you review the policy.",
            "If you do not agree with these terms, do not complete the booking. If you have questions, contact the Premium House admin on Telegram.",
        ],
    }[language];

    const progressLabel = t('booking.progress', { step });
    const dateLabelLocale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
    const selectedDatesLabel = startDate && endDate
        ? `${new Date(`${startDate}T00:00:00`).toLocaleDateString(dateLabelLocale, { day: '2-digit', month: 'short' })} → ${new Date(`${endDate}T00:00:00`).toLocaleDateString(dateLabelLocale, { day: '2-digit', month: 'short' })}`
        : t('booking.selectDatesHint');

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
            setError(t('booking.loginRequired'));
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
            setError(err instanceof Error ? err.message : t('booking.createError'));
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
            setError(t('booking.continuePaymentError'));
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
                    {t('booking.propertyMissingTitle')}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 18 }}>
                    {t('booking.propertyMissingDescription')}
                </p>
                <button
                    onClick={() => router.push('/')}
                    style={{
                        padding: '12px 22px',
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
                    {t('booking.created')}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 4 }}>
                    {t('booking.bookingCode')}: <strong style={{ color: 'var(--color-text)' }}>#{bookingResult.code}</strong>
                </p>
                <div style={{ marginBottom: 22 }}>
                    <PriceDisplay
                        amount={bookingResult.total}
                        baseCurrency={property.currency}
                        primaryStyle={{ fontSize: 20, fontWeight: 800 }}
                        secondaryStyle={{ fontSize: 12, color: 'var(--color-muted)' }}
                        align="center"
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22, textAlign: 'left' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                        {t('booking.choosePayment')}
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
                                    background: 'rgba(210, 174, 104, 0.12)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--color-brand)',
                                    fontSize: 12,
                                }}
                            >
                                {item.badge}
                            </span>
                            {t('booking.payWith', { provider: item.name })}
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
                    {t('booking.goToBookings')}
                </button>
            </div>
        );
    }

    return (
        <>
            <div style={{ minHeight: '100vh', paddingBottom: 28 }}>
                <div style={{ padding: 'calc(16px + var(--tg-safe-top, 60px)) 16px 0' }}>
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
                            {t('booking.back')}
                        </button>
                    ) : null}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: 0 }}>
                            {t('booking.title')}
                        </h1>
                        <div
                            style={{
                                padding: '5px 10px',
                                borderRadius: 999,
                                background: 'rgba(210, 174, 104, 0.1)',
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
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            <PriceDisplay
                                amount={property.price_per_night}
                                baseCurrency={property.currency}
                                primaryStyle={{ fontSize: 15, fontWeight: 800 }}
                                secondaryStyle={{ fontSize: 11, color: 'var(--color-muted)' }}
                                wrapperStyle={{ gap: 2 }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{t('units.perNight')}</span>
                        </div>
                    </div>
                </div>

                {step === 1 && (
                    <div style={{ padding: '0 16px' }}>
                        <BookingAvailabilityCalendar
                            isOpen={showCalendarModal}
                            blockedRanges={blockedRanges}
                            initialStartDate={startDate}
                            initialEndDate={endDate}
                            onClose={() => setShowCalendarModal(false)}
                            onApply={(nextStartDate, nextEndDate) => {
                                setStartDate(nextStartDate);
                                setEndDate(nextEndDate);
                            }}
                        />

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
                                {t('booking.selectDates')}
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    haptic('light');
                                    setShowCalendarModal(true);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '16px 18px',
                                    borderRadius: 18,
                                    border: '1px solid rgba(242,217,162,0.12)',
                                    background: 'linear-gradient(180deg, rgba(255,247,232,0.04) 0%, rgba(255,247,232,0.02) 100%)',
                                    color: 'var(--color-text)',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>{t('booking.openCalendar')}</div>
                                        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{selectedDatesLabel}</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                            {isAvailabilityLoading ? t('booking.calendarLoading') : t('booking.calendarSubtitle')}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 14,
                                            background: 'rgba(242,217,162,0.12)',
                                            border: '1px solid rgba(242,217,162,0.16)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <rect x="3.5" y="5" width="17" height="15" rx="3" />
                                            <path d="M8 3v4M16 3v4M3.5 10h17" />
                                        </svg>
                                    </div>
                                </div>
                            </button>

                            <div
                                style={{
                                    marginTop: 14,
                                    padding: '14px 16px',
                                    borderRadius: 16,
                                    background: 'rgba(210, 174, 104, 0.08)',
                                    color: totalNights > 0 ? 'var(--color-text)' : 'var(--color-muted)',
                                    fontSize: 13,
                                }}
                            >
                                {totalNights > 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <span>{formatUnitCount(language, 'night', totalNights)}</span>
                                        <PriceDisplay
                                            amount={estimatedTotal}
                                            baseCurrency={property.currency}
                                            primaryStyle={{ fontWeight: 800 }}
                                            secondaryStyle={{ fontSize: 11, color: 'var(--color-muted)' }}
                                            align="right"
                                        />
                                    </div>
                                ) : (
                                    t('booking.selectDatesHint')
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                padding: '18px 18px 16px',
                                borderRadius: 20,
                                border: '1px solid var(--color-line)',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(210,174,104,0.12) 100%)',
                            }}
                        >
                            <div style={{ fontSize: 12, color: 'rgba(255,247,232,0.62)', marginBottom: 6 }}>
                                {t('booking.selectedDatesTotal')}
                            </div>
                            <PriceDisplay
                                amount={estimatedTotal}
                                baseCurrency={property.currency}
                                primaryStyle={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}
                                secondaryStyle={{ fontSize: 12, color: 'var(--color-muted)' }}
                                wrapperStyle={{ gap: 4, marginBottom: 6 }}
                            />
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
                                {t('booking.priceDependsOnNights')}
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
                                    color: totalNights > 0 ? 'var(--color-ink-soft)' : 'var(--color-muted)',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    cursor: totalNights > 0 ? 'pointer' : 'not-allowed',
                                    fontFamily: 'var(--font-body)',
                                }}
                            >
                                {t('booking.goToGuestCount')}
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
                                {t('booking.guestCount')}
                            </h2>
                            <CounterRow
                                label={t('booking.totalGuests')}
                                description={t('booking.capacityHint', { count: formatUnitCount(language, 'guest', maxGuests) })}
                                value={totalGuests}
                                min={1}
                                max={maxGuests}
                                onChange={setTotalGuests}
                            />
                            <div style={{ paddingTop: 14, fontSize: 13, color: 'var(--color-muted)' }}>
                                {t('booking.fillBreakdownNext')}
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
                                color: 'var(--color-ink-soft)',
                                fontSize: 15,
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {t('booking.goToBreakdown')}
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
                                {t('booking.guestBreakdown')}
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>
                                {t('booking.breakdownIntro', { count: formatUnitCount(language, 'guest', totalGuests) })}
                            </p>

                            <CounterRow
                                label={t('booking.men')}
                                description={t('booking.adultDescription')}
                                value={guestsMen}
                                max={guestsMen + Math.max(remainingGuests, 0)}
                                onChange={setGuestsMen}
                            />
                            <CounterRow
                                label={t('booking.women')}
                                description={t('booking.adultDescription')}
                                value={guestsWomen}
                                max={guestsWomen + Math.max(remainingGuests, 0)}
                                onChange={setGuestsWomen}
                            />
                            <div style={{ borderBottom: '1px solid var(--color-line)' }}>
                                <CounterRow
                                    label={t('booking.children')}
                                    description={t('booking.childDescription')}
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
                                    ? t('booking.tooManyGuests', { count: assignedGuests - totalGuests })
                                    : hasAdultGuest
                                        ? remainingGuests > 0
                                            ? t('booking.remainingGuests', { count: remainingGuests })
                                            : t('booking.guestsReady')
                                        : t('booking.atLeastOneAdult')}
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
                                <span style={{ color: 'var(--color-muted)' }}>{t('booking.propertyNightly')}</span>
                                <PriceDisplay
                                    amount={nightlyRate}
                                    baseCurrency={property.currency}
                                    primaryStyle={{ fontWeight: 700 }}
                                    secondaryStyle={{ fontSize: 11, color: 'var(--color-muted)' }}
                                    align="right"
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>{t('booking.nights')}</span>
                                <span style={{ fontWeight: 700 }}>{formatUnitCount(language, 'night', totalNights)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>{t('booking.totalGuests')}</span>
                                <span style={{ fontWeight: 700 }}>{formatUnitCount(language, 'guest', totalGuests)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ color: 'var(--color-muted)' }}>{t('booking.enteredBreakdown')}</span>
                                <span style={{ fontWeight: 700 }}>{formatUnitCount(language, 'guest', assignedGuests)}</span>
                            </div>
                            {remainingGuests > 0 && (
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
                                    {t('booking.priceDoesNotChange', { count: remainingGuests })}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                <span style={{ color: 'var(--color-muted)' }}>{`${formatUnitCount(language, 'night', totalNights)}`}</span>
                                <PriceDisplay
                                    amount={estimatedTotal}
                                    baseCurrency={property.currency}
                                    primaryStyle={{ fontWeight: 800 }}
                                    secondaryStyle={{ fontSize: 11, color: 'var(--color-muted)' }}
                                    align="right"
                                />
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
                                {t('booking.privacyAccepted')}
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
                                color: guestBreakdownValid ? 'var(--color-ink-soft)' : 'var(--color-muted)',
                                fontSize: 15,
                                fontWeight: 800,
                                cursor: guestBreakdownValid ? 'pointer' : 'not-allowed',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {acceptedPrivacy ? t('booking.reviewPrivacy') : t('booking.openPrivacy')}
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
                        background: 'rgba(8, 6, 3, 0.82)',
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
                            background: 'linear-gradient(180deg, rgba(24,18,12,0.98) 0%, rgba(10,8,6,1) 100%)',
                            border: '1px solid rgba(210,174,104,0.14)',
                            boxShadow: '0 -20px 44px rgba(0,0,0,0.42)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '18px 18px 12px',
                                borderBottom: '1px solid rgba(210,174,104,0.12)',
                            }}
                        >
                            <div>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                                    {t('booking.privacyTitle')}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                    {t('booking.privacyReadHint')}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closePrivacyModal}
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    border: '1px solid rgba(210,174,104,0.14)',
                                    background: 'rgba(255,247,232,0.04)',
                                    color: 'var(--color-text)',
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
                                color: 'rgba(255,247,232,0.78)',
                            }}
                        >
                            {privacyParagraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </div>

                        <div style={{ padding: 18, borderTop: '1px solid rgba(210,174,104,0.12)' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '12px 14px',
                                    borderRadius: 14,
                                    background: 'rgba(255,247,232,0.04)',
                                    border: '1px solid rgba(210,174,104,0.12)',
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
                                <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text)' }}>
                                    {t('booking.acceptPrivacy')}
                                </span>
                            </label>

                            {!hasReadPrivacy && (
                                <div style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 12 }}>
                                    {t('booking.readUntilEnd')}
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
                                    background: acceptedPrivacy && !isBooking ? 'var(--gradient-brand)' : 'rgba(255,247,232,0.08)',
                                    color: acceptedPrivacy && !isBooking ? 'var(--color-ink-soft)' : 'rgba(255,247,232,0.45)',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    cursor: acceptedPrivacy && !isBooking ? 'pointer' : 'not-allowed',
                                    fontFamily: 'var(--font-body)',
                                }}
                            >
                                {isBooking ? t('booking.creating') : t('booking.bookNow')}
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
        <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
            <BookingContent />
        </Suspense>
    );
}
