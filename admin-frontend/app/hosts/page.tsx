'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { listHostBalances } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { AdminHostBalanceRow } from '../../lib/types';

export default function HostBalancesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminHostBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listHostBalances({ search: search || undefined, limit: 50, offset: 0 });
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Host balanslari yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void load();
  }, [authLoading, isAuthenticated]);

  return (
    <AdminShell title="Host balanslari" subtitle="Komissiyadan keyingi pending, available va ledger oqimi shu bo'limda ko'rinadi.">
      <div className="admin-grid">
        <div className="admin-panel" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ flex: '1 1 280px' }} placeholder="Host ismi yoki email bo'yicha qidiring" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button className="admin-button secondary" onClick={() => void load()}>Yangilash</button>
        </div>

        <div className="admin-panel" style={{ padding: 20 }}>
          {loading ? <div>Yuklanmoqda...</div> : null}
          {error ? <div style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</div> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Email</th>
                  <th>Available</th>
                  <th>Pending</th>
                  <th>Total earned</th>
                  <th>Paid out</th>
                  <th>Yangilangan</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((balance) => (
                  <tr key={balance.host_id}>
                    <td>{balance.host_name}</td>
                    <td>{balance.email || 'Email yo\'q'}</td>
                    <td>{formatMoney(balance.available_amount, balance.currency)}</td>
                    <td>{formatMoney(balance.pending_amount, balance.currency)}</td>
                    <td>{formatMoney(balance.total_earned_amount, balance.currency)}</td>
                    <td>{formatMoney(balance.total_paid_out_amount, balance.currency)}</td>
                    <td>{formatDateTime(balance.updated_at)}</td>
                    <td><Link href={`/hosts/${balance.host_id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Ledger</Link></td>
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
