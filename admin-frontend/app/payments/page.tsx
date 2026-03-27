'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import AdminPaymentMethodLogo from '../../components/AdminPaymentMethodLogo';
import AdminStatusPill from '../../components/AdminStatusPill';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { listPayments } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { AdminPaymentRow } from '../../lib/types';

const providers = ['all', 'manual', 'click', 'payme', 'rahmat', 'octo'] as const;
const statuses = ['all', 'initiated', 'pending', 'success', 'failed', 'cancelled', 'refunded', 'partial_refunded'] as const;

const providerLabels: Record<(typeof providers)[number], string> = {
  all: 'Barcha providerlar',
  manual: 'Manual',
  click: 'Click',
  payme: 'Payme',
  rahmat: 'Rahmat',
  octo: 'Octo',
};

const statusLabels: Record<(typeof statuses)[number], string> = {
  all: 'Barcha statuslar',
  initiated: 'Initiated',
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  partial_refunded: 'Partial refunded',
};

export default function PaymentsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('all');
  const [provider, setProvider] = useState<(typeof providers)[number]>('all');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listPayments({
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        provider: provider === 'all' ? undefined : provider,
        limit: 50,
        offset: 0,
      });
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To\'lovlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void load();
  }, [authLoading, isAuthenticated]);

  return (
    <AdminShell title="To'lovlar" subtitle="Manual payment navbati, gateway callback loglari va refund holati.">
      <div className="admin-grid">
        <div className="admin-panel" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ flex: '1 1 280px' }} placeholder="Bron kodi, provider ref yoki uy bo'yicha qidiring" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
            {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
          </select>
          <select value={provider} onChange={(event) => setProvider(event.target.value as (typeof providers)[number])}>
            {providers.map((item) => <option key={item} value={item}>{providerLabels[item]}</option>)}
          </select>
          <button className="admin-button secondary" onClick={() => void load()}>Yangilash</button>
        </div>

        <div className="admin-panel" style={{ padding: 20 }}>
          {loading ? <div>Yuklanmoqda...</div> : null}
          {error ? <div style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</div> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Bron</th>
                  <th>Mijoz</th>
                  <th>Uy</th>
                  <th>Status</th>
                  <th>Summa</th>
                  <th>Usul</th>
                  <th>Vaqt</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <AdminStatusPill value={payment.provider} />
                      <div style={{ marginTop: 8, color: 'var(--color-muted)', fontSize: 12 }}>{payment.provider_payment_id || 'Provider ID yo\'q'}</div>
                    </td>
                    <td>
                      <Link
                        href={`/bookings/${payment.booking_id}`}
                        style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 800 }}
                      >
                        #{payment.booking_code}
                      </Link>
                    </td>
                    <td>{payment.customer_name}</td>
                    <td>{payment.property_title}</td>
                    <td><AdminStatusPill value={payment.status} /></td>
                    <td>{formatMoney(payment.amount, payment.currency)}</td>
                    <td>
                      {payment.payment_method_name ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <AdminPaymentMethodLogo brand={payment.payment_method_brand || 'manual'} size="md" />
                            <div style={{ fontWeight: 800 }}>{payment.payment_method_name}</div>
                          </div>
                          <div style={{ marginTop: 8, color: 'var(--color-muted)', fontSize: 12 }}>
                            {payment.payment_method_brand || 'manual'} {payment.payment_method_card_number ? `• ${payment.payment_method_card_number}` : ''}
                          </div>
                        </div>
                      ) : payment.payment_url ? (
                        <a href={payment.payment_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand-light)' }}>
                          Checkout ochish
                        </a>
                      ) : 'Mavjud emas'}
                    </td>
                    <td>
                      <div>{formatDateTime(payment.created_at)}</div>
                      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>Paid: {formatDateTime(payment.paid_at)}</div>
                    </td>
                    <td>
                      <Link href={`/payments/${payment.id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Batafsil</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
