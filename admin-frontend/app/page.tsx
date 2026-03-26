'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminMetricCard from '../components/AdminMetricCard';
import AdminShell from '../components/AdminShell';
import AdminStatusPill from '../components/AdminStatusPill';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getDashboard } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import type { AdminDashboard } from '../lib/types';

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }
    const load = async () => {
      try {
        setDashboard(await getDashboard());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dashboard yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [authLoading, isAuthenticated]);

  const maxRevenue = Math.max(...(dashboard?.revenue_series.map((item) => item.amount) || [1]));

  return (
    <AdminShell title="Dashboard" subtitle="Bronlar, listinglar, to'lovlar va balanslar bo'yicha umumiy holat.">
      {loading ? <div className="admin-panel" style={{ padding: 24 }}>Dashboard yuklanmoqda...</div> : null}
      {error ? <div className="admin-panel" style={{ padding: 24, color: 'var(--color-danger)' }}>{error}</div> : null}
      {dashboard ? (
        <div className="admin-grid">
          <div className="admin-panel" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/properties/new" className="admin-button" style={{ textDecoration: 'none' }}>Yangi uy qo'shish</Link>
            <Link href="/properties" className="admin-button secondary" style={{ textDecoration: 'none' }}>Listinglar</Link>
            <Link href="/payments" className="admin-button secondary" style={{ textDecoration: 'none' }}>To'lovlar</Link>
            <Link href="/hosts" className="admin-button secondary" style={{ textDecoration: 'none' }}>Host balanslari</Link>
          </div>

          <div className="admin-metrics">
            <AdminMetricCard label="Jami bron" value={String(dashboard.kpis.total_bookings)} />
            <AdminMetricCard label="Faol bron" value={String(dashboard.kpis.active_bookings)} tone="warning" />
            <AdminMetricCard label="Faol listing" value={String(dashboard.kpis.active_listings)} tone="success" />
            <AdminMetricCard label="Pending listing" value={String(dashboard.kpis.pending_listings)} tone="warning" />
            <AdminMetricCard label="Pending payment" value={String(dashboard.kpis.pending_payments)} tone="warning" />
            <AdminMetricCard label="Jami foydalanuvchi" value={String(dashboard.kpis.total_users)} />
            <AdminMetricCard label="Jami host" value={String(dashboard.kpis.total_hosts)} />
            <AdminMetricCard label="Gross revenue" value={formatMoney(dashboard.kpis.gross_revenue)} tone="success" />
            <AdminMetricCard label="Komissiya" value={formatMoney(dashboard.kpis.platform_commission)} />
            <AdminMetricCard label="Host earning" value={formatMoney(dashboard.kpis.host_earnings)} tone="success" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr', gap: 18 }}>
            <section className="admin-panel" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 6 }}>So'nggi 7 kun revenue</div>
              <div style={{ color: 'var(--color-muted)', marginBottom: 18 }}>To'lov tushumi bo'yicha kunlik dinamika.</div>
              <div className="chart-bars">
                {dashboard.revenue_series.map((point) => {
                  const height = Math.max(18, (point.amount / maxRevenue) * 180);
                  return (
                    <div className="chart-bar" key={point.day}>
                      <div style={{ fontSize: 11, color: 'var(--color-brand-light)', fontWeight: 700 }}>{formatMoney(point.amount)}</div>
                      <div className="chart-bar-fill" style={{ height }} />
                      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{formatDate(point.day)}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="admin-panel" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 18 }}>Bron statuslari</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {dashboard.booking_statuses.map((item) => (
                  <div key={item.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AdminStatusPill value={item.status} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-panel" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 18 }}>Payment statuslari</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {dashboard.payment_statuses.map((item) => (
                  <div key={item.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AdminStatusPill value={item.status} />
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <section className="admin-panel" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 14 }}>So'nggi bronlar</div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Klient</th>
                      <th>Uy</th>
                      <th>Status</th>
                      <th>Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recent_bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td><Link href={`/bookings/${booking.id}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 700 }}>#{booking.booking_code}</Link></td>
                        <td>{booking.customer_name}</td>
                        <td>{booking.property_title}</td>
                        <td><AdminStatusPill value={booking.status} /></td>
                        <td>{formatMoney(booking.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-panel" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 14 }}>So'nggi listinglar</div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Uy</th>
                      <th>Shahar</th>
                      <th>Host</th>
                      <th>Status</th>
                      <th>Narx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recent_properties.map((property) => (
                      <tr key={property.id}>
                        <td><Link href={`/properties/${property.id}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 700 }}>{property.title}</Link></td>
                        <td>{property.city}</td>
                        <td>{property.host_name}</td>
                        <td><AdminStatusPill value={property.status} /></td>
                        <td>{formatMoney(property.price_per_night)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
