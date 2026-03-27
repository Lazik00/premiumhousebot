'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { listBookings } from '../lib/api';
import { formatMoney } from '../lib/format';

const navigation = [
  { href: '/', label: 'Dashboard' },
  { href: '/users', label: 'Foydalanuvchilar' },
  { href: '/properties', label: 'Uylar' },
  { href: '/bookings', label: 'Buyurtmalar' },
  { href: '/payment-methods', label: 'To\'lov usullari' },
  { href: '/payments', label: 'To\'lovlar' },
  { href: '/hosts', label: 'Host balanslari' },
];

const ALERTS_ENABLED_KEY = 'ph_admin_booking_alerts_enabled';
const ALERTS_KNOWN_IDS_KEY = 'ph_admin_booking_alerts_known_ids';
const ALERTS_BOOTSTRAPPED_KEY = 'ph_admin_booking_alerts_bootstrapped';

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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const knownAlertIdsRef = useRef<Set<string>>(new Set());
  const pollInFlightRef = useRef(false);

  const persistKnownAlertIds = useCallback(() => {
    if (typeof window === 'undefined') return;
    const ids = Array.from(knownAlertIdsRef.current).slice(-200);
    window.localStorage.setItem(ALERTS_KNOWN_IDS_KEY, JSON.stringify(ids));
  }, []);

  const speakNewBooking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Yangi buyurtma');
      utterance.lang = 'uz-UZ';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis failures. Notification remains visible.
    }
  }, []);

  const pushBookingNotification = useCallback(
    (bookingId: string, title: string, body: string) => {
      if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
        return;
      }
      const notification = new Notification(title, {
        body,
        tag: `booking-${bookingId}`,
      });
      notification.onclick = () => {
        window.focus();
        router.push(`/bookings/${bookingId}`);
        notification.close();
      };
    },
    [router],
  );

  const enableBrowserAlerts = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    let permission: NotificationPermission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    setNotificationPermission(permission);
    const enabled = permission === 'granted';
    setAlertsEnabled(enabled);
    window.localStorage.setItem(ALERTS_ENABLED_KEY, enabled ? '1' : '0');
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPermission(Notification.permission);
    setAlertsEnabled(window.localStorage.getItem(ALERTS_ENABLED_KEY) === '1');
    try {
      const parsed = JSON.parse(window.localStorage.getItem(ALERTS_KNOWN_IDS_KEY) || '[]');
      if (Array.isArray(parsed)) {
        knownAlertIdsRef.current = new Set(parsed.filter((item): item is string => typeof item === 'string').slice(-200));
      }
    } catch {
      knownAlertIdsRef.current = new Set();
    }
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;

    const pollAwaitingBookings = async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const response = await listBookings({
          status: 'awaiting_confirmation',
          limit: 20,
          offset: 0,
        });
        if (cancelled) return;

        setPendingApprovalCount(response.total);

        if (typeof window === 'undefined') return;

        const bootstrapped = window.localStorage.getItem(ALERTS_BOOTSTRAPPED_KEY) === '1';
        const knownIds = knownAlertIdsRef.current;

        if (!bootstrapped) {
          response.items.forEach((booking) => knownIds.add(booking.id));
          window.localStorage.setItem(ALERTS_BOOTSTRAPPED_KEY, '1');
          persistKnownAlertIds();
          return;
        }

        const newItems = response.items.filter((booking) => !knownIds.has(booking.id));
        if (newItems.length > 0) {
          newItems.forEach((booking) => knownIds.add(booking.id));
          persistKnownAlertIds();
        }

        if (newItems.length > 0 && alertsEnabled && notificationPermission === 'granted') {
          for (const booking of [...newItems].reverse()) {
            pushBookingNotification(
              booking.id,
              'Yangi buyurtma',
              `${booking.customer_name} • ${booking.property_title} • ${formatMoney(booking.total_price, booking.currency)}`,
            );
          }
          speakNewBooking();
        }
      } catch {
        // Silent polling failure. Admin pages remain usable.
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void pollAwaitingBookings();
    const timer = window.setInterval(() => {
      void pollAwaitingBookings();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [alertsEnabled, isAuthenticated, isLoading, notificationPermission, persistKnownAlertIds, pushBookingNotification, speakNewBooking]);

  const notificationLabel = useMemo(() => {
    if (notificationPermission === 'unsupported') return 'Brauzer qo‘llamaydi';
    if (notificationPermission === 'granted' && alertsEnabled) {
      return pendingApprovalCount > 0 ? `Bildirishnoma • ${pendingApprovalCount}` : 'Bildirishnoma yoqilgan';
    }
    if (notificationPermission === 'denied') return 'Bildirishnoma bloklangan';
    return 'Bildirishnomani yoqish';
  }, [alertsEnabled, notificationPermission, pendingApprovalCount]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.92, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {notificationPermission !== 'unsupported' ? (
              <button
                type="button"
                className={`admin-button secondary${alertsEnabled && notificationPermission === 'granted' ? ' notification-live' : ''}`}
                onClick={() => void enableBrowserAlerts()}
                style={{ position: 'relative' }}
              >
                <span style={{ fontSize: 16 }}>{alertsEnabled && notificationPermission === 'granted' ? '🔔' : '🔕'}</span>
                <span>{notificationLabel}</span>
                {alertsEnabled && notificationPermission === 'granted' && pendingApprovalCount > 0 ? (
                  <span className="admin-header-badge">{pendingApprovalCount}</span>
                ) : null}
              </button>
            ) : null}
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
