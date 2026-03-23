'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMyBookings } from '../../lib/api';
import { haptic } from '../../lib/telegram';
import { useAuth } from '../../context/AuthContext';
import type { Booking } from '../../lib/types';
import { BookingCardSkeleton } from '../../components/LoadingSkeleton';
import BottomNav from '../../components/BottomNav';

function formatPrice(price: number): string {
    return `${new Intl.NumberFormat('uz-UZ').format(price)} so'm`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

const statusConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
    pending_payment: { label: 'To\'lov kutilmoqda', color: '#fdcb6e', bg: 'rgba(253,203,110,0.12)', emoji: '⏳' },
    confirmed: { label: 'Tasdiqlangan', color: '#00b894', bg: 'rgba(0,184,148,0.12)', emoji: '✅' },
    completed: { label: 'Yakunlangan', color: '#6c5ce7', bg: 'rgba(108,92,231,0.12)', emoji: '🏁' },
    cancelled: { label: 'Bekor qilingan', color: '#d63031', bg: 'rgba(214,48,49,0.12)', emoji: '❌' },
    expired: { label: 'Muddati o\'tgan', color: '#636e72', bg: 'rgba(99,110,114,0.12)', emoji: '⌛' },
};

const tabs = [
    { key: 'active', label: 'Faol' },
    { key: 'past', label: 'O\'tgan' },
    { key: 'all', label: 'Hammasi' },
];

export default function BookingsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active');

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
                        Tizimga kirish kerak
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                        Buyurtmalarni ko&apos;rish uchun Telegram orqali tizimga kiring
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
                    Buyurtmalarim
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
                                color: activeTab === tab.key ? '#fff' : 'var(--color-muted)',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {tab.label}
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
                        const status = statusConfig[booking.status] || statusConfig.expired;
                        const helperText = booking.status === 'pending_payment'
                            ? 'Ichiga kirib to\'lovni davom ettiring'
                            : booking.status === 'confirmed'
                                ? 'Ichida buyurtma ma\'lumotlari va bekor qilish tugmasi bor'
                                : 'Buyurtma tafsilotlarini ko\'rish';

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
                                            background: 'rgba(108, 92, 231, 0.06)',
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>Kirish</div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(booking.start_date)}</div>
                                        </div>
                                        <div style={{ color: 'var(--color-muted)' }}>→</div>
                                        <div style={{ flex: 1, textAlign: 'right' }}>
                                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>Chiqish</div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(booking.end_date)}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                                            {booking.total_nights} kecha • {booking.guests_total} kishi
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                                            <span className="text-gradient">{formatPrice(booking.total_price)}</span>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 12,
                                            background: booking.status === 'pending_payment'
                                                ? 'rgba(253,203,110,0.12)'
                                                : 'rgba(108,92,231,0.08)',
                                            color: booking.status === 'pending_payment' ? '#fdcb6e' : 'var(--color-brand-light)',
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {helperText}
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
                            Buyurtmalar yo&apos;q
                        </h3>
                        <p style={{ fontSize: 14, marginBottom: 20 }}>
                            {activeTab === 'active' ? 'Faol buyurtmalar mavjud emas' : 'Hali buyurtma qilmadingiz'}
                        </p>
                        <button
                            onClick={() => { haptic('light'); router.push('/'); }}
                            style={{
                                padding: '12px 24px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'var(--gradient-brand)',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            Uylarni ko&apos;rish
                        </button>
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
