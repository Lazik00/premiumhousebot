'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { haptic } from '../lib/telegram';

const tabs = [
    {
        href: '/',
        label: 'Bosh sahifa',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-brand-light)' : 'var(--color-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        href: '/search',
        label: 'Qidiruv',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-brand-light)' : 'var(--color-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
        ),
    },
    {
        href: '/bookings',
        label: 'Buyurtmalar',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-brand-light)' : 'var(--color-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        ),
    },
    {
        href: '/profile',
        label: 'Profil',
        icon: (active: boolean) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-brand-light)' : 'var(--color-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                background: 'rgba(8, 6, 3, 0.88)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderTop: '1px solid rgba(210, 174, 104, 0.12)',
                paddingBottom: 'var(--safe-area-bottom, 0px)',
                boxShadow: '0 -12px 32px rgba(0,0,0,0.22)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    height: 'var(--bottom-nav-height)',
                    maxWidth: 480,
                    margin: '0 auto',
                }}
            >
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            onClick={() => haptic('light')}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                                padding: '7px 16px',
                                textDecoration: 'none',
                                borderRadius: 14,
                                transition: 'all 0.2s ease',
                                position: 'relative',
                            }}
                        >
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isActive && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            width: 40,
                                            height: 40,
                                            borderRadius: 14,
                                            background: 'rgba(210, 174, 104, 0.12)',
                                            border: '1px solid rgba(242,217,162,0.14)',
                                            boxShadow: 'var(--shadow-glow)',
                                            animation: 'scaleIn 0.2s ease',
                                        }}
                                    />
                                )}
                                {tab.icon(isActive)}
                            </div>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'var(--color-brand-light)' : 'var(--color-muted)',
                                    transition: 'color 0.2s ease',
                                }}
                            >
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
