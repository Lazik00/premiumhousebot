'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';

const navigation = [
  { href: '/', label: 'Dashboard' },
  { href: '/users', label: 'Foydalanuvchilar' },
  { href: '/properties', label: 'Uylar' },
  { href: '/bookings', label: 'Buyurtmalar' },
  { href: '/payment-methods', label: 'To\'lov usullari' },
  { href: '/payments', label: 'To\'lovlar' },
  { href: '/hosts', label: 'Host balanslari' },
];

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAdminAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="login-shell">
        <div className="admin-panel" style={{ padding: 24, width: 320, textAlign: 'center' }}>
          <div style={{ color: 'var(--color-brand-light)', fontWeight: 700 }}>Admin panel yuklanmoqda...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src="/admin/brand/logo-mark.png" alt="Premium House" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <div>
            <div
              style={{
                fontSize: 20,
                lineHeight: 0.94,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
                background: 'linear-gradient(135deg, #f6e7bd 0%, #d3a758 48%, #f5de9d 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Premium
            </div>
            <div style={{ fontSize: 11, color: '#d9b061', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800 }}>
              House Rent
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1, marginTop: 6 }}>Admin Panel</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 28 }}>
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: 'none',
                  color: active ? 'var(--color-ink)' : 'var(--color-text)',
                  background: active ? 'var(--gradient-brand)' : 'transparent',
                  border: active ? 'none' : '1px solid transparent',
                  borderRadius: 16,
                  padding: '13px 16px',
                  fontWeight: 700,
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="admin-panel" style={{ padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>Joriy admin</div>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{[user.first_name, user.last_name].filter(Boolean).join(' ')}</div>
          <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 10 }}>{user.email || user.username || 'admin@premium.house'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {user.roles.map((role) => (
              <span key={role} className={`status-pill ${role === 'super_admin' ? 'success' : 'pending'}`}>
                {role.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => void logout().then(() => router.replace('/login'))}
          style={{
            width: '100%',
            border: '1px solid rgba(214, 122, 97, 0.28)',
            background: 'rgba(214, 122, 97, 0.08)',
            color: 'var(--color-danger)',
            borderRadius: 16,
            padding: '13px 16px',
            fontWeight: 800,
          }}
        >
          Chiqish
        </button>
      </aside>

      <main className="admin-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 0.95 }}>{title}</div>
            {subtitle ? <div style={{ color: 'var(--color-muted)', marginTop: 10 }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.92 }}>
            <img src="/admin/brand/logo-mark.png" alt="Premium House" style={{ width: 38, height: 38, objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  fontSize: 18,
                  lineHeight: 0.94,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-body)',
                  background: 'linear-gradient(135deg, #f6e7bd 0%, #d3a758 48%, #f5de9d 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Premium
              </div>
              <div style={{ fontSize: 10, color: '#d9b061', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800 }}>
                House Rent
              </div>
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
