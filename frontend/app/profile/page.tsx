'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { haptic } from '../../lib/telegram';
import { ProfileSkeleton } from '../../components/LoadingSkeleton';
import BottomNav from '../../components/BottomNav';

export default function ProfilePage() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated, logout } = useAuth();

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh' }}>
                <ProfileSkeleton />
                <BottomNav />
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return (
            <div style={{ minHeight: '100vh' }}>
                <div style={{ padding: 'calc(60px + var(--tg-safe-top, 60px)) 20px 60px', textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>👤</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                        Profil
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 20 }}>
                        Telegram orqali tizimga kiring
                    </p>
                </div>
                <BottomNav />
            </div>
        );
    }

    const menuItems = [
        {
            icon: '📋',
            label: 'Mening buyurtmalarim',
            subtitle: 'Barcha buyurtmalarni ko\'rish',
            action: () => router.push('/bookings'),
        },
        {
            icon: '🏠',
            label: 'Uylarni ko\'rish',
            subtitle: 'Premium uylarni topish',
            action: () => router.push('/'),
        },
        {
            icon: '🌐',
            label: 'Til',
            subtitle: 'O\'zbek',
            action: () => { },
        },
        {
            icon: 'ℹ️',
            label: 'Ilova haqida',
            subtitle: 'Premium House v1.0',
            action: () => { },
        },
    ];

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Header */}
            <div
                style={{
                    background: 'var(--gradient-hero)',
                    padding: 'calc(32px + var(--tg-safe-top, 60px)) 16px 40px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative */}
                <div
                    style={{
                        position: 'absolute',
                        top: -40,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 300,
                        height: 300,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(108, 92, 231, 0.15) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }}
                />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Avatar */}
                    <div
                        style={{
                            width: 88,
                            height: 88,
                            borderRadius: 24,
                            margin: '0 auto 14px',
                            background: user.photo_url
                                ? `url(${user.photo_url}) center/cover`
                                : 'var(--gradient-brand)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 36,
                            fontWeight: 800,
                            color: '#fff',
                            boxShadow: 'var(--shadow-glow)',
                            border: '3px solid rgba(108, 92, 231, 0.3)',
                        }}
                    >
                        {!user.photo_url && user.first_name[0]}
                    </div>

                    <h2
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 22,
                            fontWeight: 800,
                            marginBottom: 4,
                        }}
                    >
                        {user.first_name} {user.last_name || ''}
                    </h2>

                    {user.username && (
                        <div style={{ fontSize: 14, color: 'var(--color-brand-light)' }}>@{user.username}</div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div
                style={{
                    display: 'flex',
                    margin: '-20px 16px 20px',
                    gap: 10,
                    position: 'relative',
                    zIndex: 2,
                }}
            >
                {[
                    { label: 'Telegram ID', value: `${user.telegram_id}` },
                    { label: 'Status', value: 'status' in user && user.status === 'active' ? '🟢 Faol' : '🔴' },
                ].map((s) => (
                    <div
                        key={s.label}
                        style={{
                            flex: 1,
                            padding: '14px 16px',
                            borderRadius: 14,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-line)',
                            textAlign: 'center',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Menu */}
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menuItems.map((item, index) => (
                    <button
                        key={item.label}
                        onClick={() => { haptic('light'); item.action(); }}
                        className="slide-up hover-lift"
                        style={{
                            animationDelay: `${index * 0.05}s`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '14px 16px',
                            borderRadius: 14,
                            border: '1px solid var(--color-line)',
                            background: 'var(--color-surface)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            fontFamily: 'var(--font-body)',
                        }}
                    >
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'rgba(108, 92, 231, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                flexShrink: 0,
                            }}
                        >
                            {item.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{item.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{item.subtitle}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                ))}

                {/* Logout */}
                <button
                    onClick={async () => {
                        haptic('heavy');
                        await logout();
                        router.push('/');
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '14px 16px',
                        borderRadius: 14,
                        border: '1px solid rgba(214, 48, 49, 0.2)',
                        background: 'transparent',
                        color: 'var(--color-danger)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: 8,
                        width: '100%',
                        fontFamily: 'var(--font-body)',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Chiqish
                </button>
            </div>

            <BottomNav />
        </div>
    );
}
