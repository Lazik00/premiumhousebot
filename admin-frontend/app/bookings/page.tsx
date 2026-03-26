'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import AdminStatusPill from '../../components/AdminStatusPill';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { listBookings } from '../../lib/api';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import type { AdminBookingRow } from '../../lib/types';

const statuses = ['all', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'expired'] as const;

function remainingTime(expiresAt?: string | null, now = Date.now()) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return 'Eskirgan';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 0) return `${hours} soat ${minutes} daqiqa`;
  return `${minutes} daqiqa ${seconds} soniya`;
}

export default function BookingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('all');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listBookings({ search: search || undefined, status: status === 'all' ? undefined : status, limit: 50, offset: 0 });
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Buyurtmalar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void load();
  }, [authLoading, isAuthenticated]);

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending_payment').length, [items]);

  return (
    <AdminShell title="Buyurtmalar" subtitle="Booking oqimi, pending payment timer va tasdiqlangan bronlar nazorati.">
      <div className="admin-subgrid" style={{ marginBottom: 18 }}>
        <div className="admin-panel" style={{ padding: 20 }}>
          <div className="admin-section-title">Faol kuzatuv</div>
          <div className="admin-kv-list" style={{ marginTop: 16 }}>
            <div className="admin-kv"><span>Pending payment</span><strong>{pendingCount}</strong></div>
            <div className="admin-kv"><span>Jami ko'rsatilgan bron</span><strong>{items.length}</strong></div>
          </div>
        </div>
        <div className="admin-panel" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ flex: '1 1 280px' }} placeholder="Bron kodi, mijoz yoki uy bo'yicha qidirish" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
            {statuses.map((item) => <option key={item} value={item}>{item === 'all' ? 'Barcha statuslar' : item}</option>)}
          </select>
          <button className="admin-button secondary" onClick={() => void load()}>Yangilash</button>
        </div>
      </div>

      <div className="admin-panel" style={{ padding: 20 }}>
        {loading ? <div>Yuklanmoqda...</div> : null}
        {error ? <div style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</div> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bron</th>
                <th>Mijoz</th>
                <th>Uy</th>
                <th>Sana</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Summa</th>
                <th>Timer</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>#{booking.booking_code}</div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{booking.total_nights} kecha • {booking.guests_total} mehmon</div>
                  </td>
                  <td>{booking.customer_name}</td>
                  <td>{booking.property_title}</td>
                  <td>{formatDate(booking.start_date)} - {formatDate(booking.end_date)}</td>
                  <td><AdminStatusPill value={booking.status} /></td>
                  <td>
                    {booking.payment_provider ? <AdminStatusPill value={booking.payment_provider} /> : 'Mavjud emas'}
                    <div style={{ marginTop: 8 }}>{booking.payment_status ? <AdminStatusPill value={booking.payment_status} /> : null}</div>
                  </td>
                  <td>{formatMoney(booking.total_price, booking.currency)}</td>
                  <td>
                    {booking.status === 'pending_payment' ? (
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--color-warning)' }}>{remainingTime(booking.expires_at, now)}</div>
                        <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{formatDateTime(booking.expires_at)}</div>
                      </div>
                    ) : booking.confirmed_at ? formatDateTime(booking.confirmed_at) : '-'}
                  </td>
                  <td>
                    <Link href={`/bookings/${booking.id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Batafsil</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
