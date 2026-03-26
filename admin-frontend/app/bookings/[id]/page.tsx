'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import AdminStatusPill from '../../../components/AdminStatusPill';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { getBooking } from '../../../lib/api';
import { formatDate, formatDateTime, formatMoney, fullName } from '../../../lib/format';
import type { AdminBookingDetail } from '../../../lib/types';

function remainingTime(expiresAt?: string | null, now = Date.now()) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return 'Eskirgan';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 0) return `${hours} soat ${minutes} daqiqa ${seconds} soniya`;
  return `${minutes} daqiqa ${seconds} soniya`;
}

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = String(params.id || '');
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !bookingId) return;
    const load = async () => {
      try {
        setBooking(await getBooking(bookingId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Booking detail yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [authLoading, isAuthenticated, bookingId]);

  const pendingTimer = useMemo(() => remainingTime(booking?.expires_at, now), [booking?.expires_at, now]);

  return (
    <AdminShell title={booking ? `Bron #${booking.booking_code}` : 'Bron detail'} subtitle="Booking statusi, payment tarixi va audit eventlari.">
      <div style={{ marginBottom: 18 }}>
        <Link href="/bookings" className="admin-button secondary" style={{ textDecoration: 'none' }}>Buyurtmalar ro'yxatiga qaytish</Link>
      </div>

      {loading ? <div className="admin-panel" style={{ padding: 24 }}>Yuklanmoqda...</div> : null}
      {error ? <div className="admin-panel" style={{ padding: 24, color: 'var(--color-danger)' }}>{error}</div> : null}

      {booking ? (
        <div className="admin-grid">
          <div className="admin-metrics admin-metrics-4">
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Status</div><div style={{ marginTop: 10 }}><AdminStatusPill value={booking.status} /></div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Summa</div><div className="admin-stat-value">{formatMoney(booking.total_price, booking.currency)}</div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Muddat</div><div className="admin-stat-value">{booking.total_nights} kecha</div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Pending timer</div><div className="admin-stat-value" style={{ color: 'var(--color-warning)' }}>{booking.status === 'pending_payment' ? pendingTimer : formatDateTime(booking.confirmed_at)}</div></div>
          </div>

          <div className="admin-subgrid">
            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Bron ma'lumotlari</div>
              <div className="admin-kv-list" style={{ marginTop: 16 }}>
                <div className="admin-kv"><span>Kirish</span><strong>{formatDate(booking.start_date)}</strong></div>
                <div className="admin-kv"><span>Chiqish</span><strong>{formatDate(booking.end_date)}</strong></div>
                <div className="admin-kv"><span>Jami mehmon</span><strong>{booking.guests_total}</strong></div>
                <div className="admin-kv"><span>Erkak / Ayol / Bola</span><strong>{booking.guests_adults_men} / {booking.guests_adults_women} / {booking.guests_children}</strong></div>
                <div className="admin-kv"><span>Yaratilgan</span><strong>{formatDateTime(booking.created_at)}</strong></div>
                <div className="admin-kv"><span>Tasdiqlangan</span><strong>{formatDateTime(booking.confirmed_at)}</strong></div>
                <div className="admin-kv"><span>Bekor sababi</span><strong>{booking.cancel_reason || 'Mavjud emas'}</strong></div>
              </div>
            </div>

            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Customer</div>
              <div className="admin-kv-list" style={{ marginTop: 16 }}>
                <div className="admin-kv"><span>FIO</span><strong>{fullName(booking.customer.first_name, booking.customer.last_name)}</strong></div>
                <div className="admin-kv"><span>Email</span><strong>{booking.customer.email || 'Yo\'q'}</strong></div>
                <div className="admin-kv"><span>Username</span><strong>{booking.customer.username ? `@${booking.customer.username}` : 'Yo\'q'}</strong></div>
                <div className="admin-kv"><span>Status</span><strong>{booking.customer.status}</strong></div>
                <div className="admin-kv"><span>Jami bronlar</span><strong>{booking.customer.total_bookings}</strong></div>
              </div>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 22 }}>
            <div className="admin-header-row">
              <div>
                <div className="admin-section-title">Uy</div>
                <div className="admin-section-subtitle">Property kartasi va listingga o'tish.</div>
              </div>
              <Link href={`/properties/${booking.property.id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Listingni ochish</Link>
            </div>
            <div className="admin-kv-list" style={{ marginTop: 16 }}>
              <div className="admin-kv"><span>Sarlavha</span><strong>{booking.property.title}</strong></div>
              <div className="admin-kv"><span>Lokatsiya</span><strong>{booking.property.city}, {booking.property.region}</strong></div>
              <div className="admin-kv"><span>Host</span><strong>{booking.property.host_name}</strong></div>
              <div className="admin-kv"><span>Property turi</span><strong>{booking.property.property_type}</strong></div>
              <div className="admin-kv"><span>Narx</span><strong>{formatMoney(booking.property.price_per_night)}</strong></div>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 22 }}>
            <div className="admin-section-title">Payment tarixi</div>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Summa</th>
                    <th>Vaqt</th>
                    <th>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <AdminStatusPill value={payment.provider} />
                        <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>{payment.provider_payment_id || 'Provider ID yo\'q'}</div>
                      </td>
                      <td><AdminStatusPill value={payment.status} /></td>
                      <td>{formatMoney(payment.amount, payment.currency)}</td>
                      <td>{formatDateTime(payment.created_at)}</td>
                      <td><Link href={`/payments/${payment.id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Payment detail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 22 }}>
            <div className="admin-section-title">Audit eventlar</div>
            <div className="admin-stack" style={{ marginTop: 16, gap: 14 }}>
              {booking.events.map((event) => (
                <div key={event.id} className="admin-timeline-item">
                  <div className="admin-timeline-dot" />
                  <div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <strong>{event.event_type}</strong>
                      {event.old_status ? <AdminStatusPill value={event.old_status} /> : null}
                      {event.new_status ? <AdminStatusPill value={event.new_status} /> : null}
                    </div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 6 }}>{formatDateTime(event.created_at)}</div>
                    <pre className="admin-pre" style={{ marginTop: 10 }}>{JSON.stringify(event.event_payload, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
