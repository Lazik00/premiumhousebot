'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { getHostBalance } from '../../../lib/api';
import { formatDateTime, formatMoney } from '../../../lib/format';
import type { AdminHostBalanceDetail } from '../../../lib/types';

export default function HostBalanceDetailPage() {
  const params = useParams();
  const hostId = String(params.id || '');
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [detail, setDetail] = useState<AdminHostBalanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !hostId) return;
    const load = async () => {
      try {
        setDetail(await getHostBalance(hostId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Host balance detail yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [authLoading, isAuthenticated, hostId]);

  return (
    <AdminShell title={detail ? detail.host_name : 'Host ledger'} subtitle="Host hisobidagi available, pending va ledger yozuvlari.">
      <div style={{ marginBottom: 18 }}>
        <Link href="/hosts" className="admin-button secondary" style={{ textDecoration: 'none' }}>Host balanslariga qaytish</Link>
      </div>

      {loading ? <div className="admin-panel" style={{ padding: 24 }}>Yuklanmoqda...</div> : null}
      {error ? <div className="admin-panel" style={{ padding: 24, color: 'var(--color-danger)' }}>{error}</div> : null}

      {detail ? (
        <div className="admin-grid">
          <div className="admin-metrics admin-metrics-4">
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Available</div><div className="admin-stat-value">{formatMoney(detail.available_amount, detail.currency)}</div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Pending</div><div className="admin-stat-value">{formatMoney(detail.pending_amount, detail.currency)}</div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Total earned</div><div className="admin-stat-value">{formatMoney(detail.total_earned_amount, detail.currency)}</div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Paid out</div><div className="admin-stat-value">{formatMoney(detail.total_paid_out_amount, detail.currency)}</div></div>
          </div>

          <div className="admin-panel" style={{ padding: 22 }}>
            <div className="admin-section-title">Host overview</div>
            <div className="admin-kv-list" style={{ marginTop: 16 }}>
              <div className="admin-kv"><span>Host</span><strong>{detail.host_name}</strong></div>
              <div className="admin-kv"><span>Email</span><strong>{detail.email || 'Yo\'q'}</strong></div>
              <div className="admin-kv"><span>Currency</span><strong>{detail.currency}</strong></div>
              <div className="admin-kv"><span>Updated</span><strong>{formatDateTime(detail.updated_at)}</strong></div>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 22 }}>
            <div className="admin-section-title">Ledger entries</div>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Yo'nalish</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.ledger_entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.direction}</td>
                      <td>{formatMoney(entry.amount, entry.currency)}</td>
                      <td>{entry.description || 'Yo\'q'}</td>
                      <td>{entry.reference_type || 'Yo\'q'} {entry.reference_id ? `• ${entry.reference_id}` : ''}</td>
                      <td>{formatDateTime(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
