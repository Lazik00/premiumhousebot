'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import AdminPaymentMethodLogo from '../../../components/AdminPaymentMethodLogo';
import AdminStatusPill from '../../../components/AdminStatusPill';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { approveBookingPayment, getBooking, rejectBookingPayment } from '../../../lib/api';
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
  const [reviewNote, setReviewNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

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
  const pendingManualPayment = useMemo(
    () => booking?.payments.find((item) => item.provider === 'manual' && item.status === 'pending') || null,
    [booking],
  );

  const refreshBooking = async () => {
    const detail = await getBooking(bookingId);
    setBooking(detail);
  };

  const handleApprove = async () => {
    if (!booking) return;
    setApproving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await approveBookingPayment(booking.id, reviewNote || undefined);
      await refreshBooking();
      setActionSuccess('Bron tasdiqlandi va buyerga Telegram xabari yuborildi.');
      setReviewNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Tasdiqlash amalga oshmadi');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!booking) return;
    setRejecting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await rejectBookingPayment(booking.id, reviewNote || undefined);
      await refreshBooking();
      setActionSuccess(
        result.booking_status === 'cancelled'
          ? 'Bron bekor qilindi. Buyer tomonda status darrov yangilanadi.'
          : 'Manual payment rad etildi.',
      );
      setReviewNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rad etish amalga oshmadi');
    } finally {
      setRejecting(false);
    }
  };

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
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Pending timer</div><div className="admin-stat-value" style={{ color: ['pending_payment', 'awaiting_confirmation'].includes(booking.status) ? 'var(--color-warning)' : 'var(--color-text)' }}>{['pending_payment', 'awaiting_confirmation'].includes(booking.status) ? pendingTimer : formatDateTime(booking.confirmed_at)}</div></div>
          </div>

          {booking.status === 'awaiting_confirmation' && pendingManualPayment ? (
            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-header-row">
                <div>
                  <div className="admin-section-title">Manual payment tasdiqlash</div>
                  <div className="admin-section-subtitle">Buyer to'lov qildim deb yuborgan. Rekvizitni tekshirib, bronni qo'lda tasdiqlang yoki rad eting.</div>
                </div>
                <AdminStatusPill value="awaiting_confirmation" />
              </div>

              <div className="admin-subgrid" style={{ marginTop: 18 }}>
                <div className="admin-panel" style={{ padding: 18 }}>
                  <div className="admin-section-subtitle">Tanlangan usul</div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <AdminPaymentMethodLogo brand={pendingManualPayment.payment_method_brand || 'manual'} size="lg" />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 20 }}>{pendingManualPayment.payment_method_name || 'Manual payment'}</div>
                      <div style={{ marginTop: 10, color: 'var(--color-muted)' }}>{pendingManualPayment.payment_method_brand || 'manual'} • {pendingManualPayment.payment_method_card_number || 'Karta raqami yo\'q'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }} className="admin-kv-list">
                    <div className="admin-kv"><span>Karta egasi</span><strong>{pendingManualPayment.payment_method_card_holder || 'Mavjud emas'}</strong></div>
                    <div className="admin-kv"><span>Buyer izohi</span><strong>{pendingManualPayment.customer_note || 'Qoldirilmagan'}</strong></div>
                    <div className="admin-kv"><span>Yuborilgan vaqt</span><strong>{formatDateTime(pendingManualPayment.created_at)}</strong></div>
                  </div>
                </div>

                <div className="admin-panel" style={{ padding: 18 }}>
                  <div className="admin-section-subtitle">Admin qarori</div>
                  <label className="admin-field" style={{ marginTop: 12 }}>
                    <span>Ichki izoh</span>
                    <textarea
                      rows={5}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="Masalan: bank ilovadan pul tushumi tekshirildi yoki screenshot mos kelmadi."
                    />
                  </label>
                  {actionError ? <div className="admin-alert danger" style={{ marginTop: 14 }}>{actionError}</div> : null}
                  {actionSuccess ? <div className="admin-alert success" style={{ marginTop: 14 }}>{actionSuccess}</div> : null}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                    <button className="admin-button" type="button" onClick={() => void handleApprove()} disabled={approving || rejecting}>
                      {approving ? 'Tasdiqlanmoqda...' : 'Bronni tasdiqlash'}
                    </button>
                    <button className="admin-button danger" type="button" onClick={() => void handleReject()} disabled={approving || rejecting}>
                      {rejecting ? 'Rad etilmoqda...' : 'Rad etish'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

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
                    <th>Usul</th>
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
                      <td>
                        {payment.payment_method_name ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <AdminPaymentMethodLogo brand={payment.payment_method_brand || 'manual'} size="md" />
                              <div style={{ fontWeight: 800 }}>{payment.payment_method_name}</div>
                            </div>
                            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
                              {payment.payment_method_brand || 'manual'} • {payment.payment_method_card_number || 'raqam yo\'q'}
                            </div>
                            {payment.customer_note ? (
                              <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
                                Buyer izohi: {payment.customer_note}
                              </div>
                            ) : null}
                          </div>
                        ) : 'Mavjud emas'}
                      </td>
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
