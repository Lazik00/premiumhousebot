'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPaymentLink, getBooking, getProperty } from '@/lib/api';
import type { Booking, PropertyDetail } from '@/lib/types';
import { getTelegramWebApp, haptic } from '@/lib/telegram';
import { useAuth } from '@/context/AuthContext';

const adminContact = {
    username: '@premiumhouse_admin',
    link: 'https://t.me/premiumhouse_admin',
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending_payment: { label: 'To\'lov kutilmoqda', color: '#fdcb6e', bg: 'rgba(253,203,110,0.12)' },
    confirmed: { label: 'Tasdiqlangan', color: '#00b894', bg: 'rgba(0,184,148,0.12)' },
    completed: { label: 'Yakunlangan', color: '#6c5ce7', bg: 'rgba(108,92,231,0.12)' },
    cancelled: { label: 'Bekor qilingan', color: '#d63031', bg: 'rgba(214,48,49,0.12)' },
    expired: { label: 'Muddati o\'tgan', color: '#636e72', bg: 'rgba(99,110,114,0.12)' },
};

function formatPrice(price: number, currency = 'UZS'): string {
    if (currency === 'UZS') {
        return `${new Intl.NumberFormat('uz-UZ').format(price)} so'm`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function BookingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
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
                setError(err instanceof Error ? err.message : 'Buyurtma topilmadi');
            } finally {
                setIsLoading(false);
            }
        };

        boot();
    }, [bookingId, isAuthenticated, authLoading]);

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
            setError(err instanceof Error ? err.message : 'To\'lov havolasi yaratilmadi');
        } finally {
            setIsPaying(false);
        }
    };

    if (!authLoading && !isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                    Tizimga kirish kerak
                </h1>
                <p style={{ color: 'var(--color-muted)' }}>
                    Buyurtma tafsilotlarini ko'rish uchun Telegram orqali tizimga kiring.
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
                    Orqaga
                </button>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                    Buyurtma topilmadi
                </h1>
                <p style={{ color: 'var(--color-muted)' }}>{error || 'Buyurtma mavjud emas'}</p>
            </div>
        );
    }

    const status = statusConfig[booking.status] || statusConfig.expired;
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
                Buyurtmalarimga qaytish
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
                            ? `linear-gradient(180deg, rgba(7,10,18,0.1) 0%, rgba(7,10,18,0.6) 100%), url(${property.cover_image}) center/cover`
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
                        {property?.title || 'Buyurtma tafsilotlari'}
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
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(108,92,231,0.12) 100%)',
                    border: '1px solid var(--color-line)',
                    marginBottom: 16,
                }}
            >
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', marginBottom: 8 }}>Umumiy summa</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
                    <span className="text-gradient">{formatPrice(booking.total_price, property?.currency || 'UZS')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    Narx faqat {booking.total_nights} kecha uchun hisoblangan. Mehmonlar tarkibi summaga ta'sir qilmaydi.
                </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                {[
                    { label: 'Kirish sanasi', value: formatDate(booking.start_date) },
                    { label: 'Chiqish sanasi', value: formatDate(booking.end_date) },
                    { label: 'Bir kecha narxi', value: formatPrice(nightlyPrice, property?.currency || 'UZS') },
                    { label: 'Muddati', value: `${booking.total_nights} kecha` },
                    { label: 'Jami mehmon', value: `${booking.guests_total} kishi` },
                    { label: 'Kiritilgan tarkib', value: `${assignedGuests} kishi` },
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
                        <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{item.value}</span>
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
                    Mehmonlar tarkibi
                </h2>
                <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>Erkaklar</span>
                        <strong>{booking.guests_adults_men}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>Ayollar</span>
                        <strong>{booking.guests_adults_women}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>Bolalar</span>
                        <strong>{booking.guests_children}</strong>
                    </div>
                    {unknownGuests > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>Aniqlashtirilmagan</span>
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
                        border: '1px solid rgba(253,203,110,0.2)',
                        background: 'rgba(253,203,110,0.08)',
                        marginBottom: 16,
                    }}
                >
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                        To'lovni davom ettirish
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
                        Buyurtma hali tasdiqlanmagan. Ichidan to'lov usulini tanlab davom eting.
                    </p>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {[
                            { provider: 'click' as const, label: 'Click orqali to\'lash' },
                            { provider: 'payme' as const, label: 'Payme orqali to\'lash' },
                            { provider: 'rahmat' as const, label: 'Rahmat orqali to\'lash' },
                        ].map((item) => (
                            <button
                                key={item.provider}
                                disabled={isPaying}
                                onClick={() => handlePayment(item.provider)}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    background: '#151922',
                                    color: '#fff',
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
                        Buyurtmani bekor qilish
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-muted)', marginBottom: 14 }}>
                        Tugmani bossangiz admin username profiliga o'tasiz. Bekor qilish qo'lda ko'rib chiqiladi.
                    </p>
                    <button
                        onClick={openAdminProfile}
                        style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: 14,
                            border: 'none',
                            background: 'var(--gradient-brand)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        {adminContact.username} profiliga o'tish
                    </button>
                </div>
            )}
        </div>
    );
}
