'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import AdminStatusPill from '../../components/AdminStatusPill';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { listUsers, updateUserStatus } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { AdminUserRow } from '../../lib/types';

const statuses = ['all', 'active', 'blocked', 'pending'] as const;

export default function UsersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('all');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listUsers({ search: search || undefined, status: status === 'all' ? undefined : status, limit: 50, offset: 0 });
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foydalanuvchilar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }
    void load();
  }, [authLoading, isAuthenticated]);

  const handleStatusChange = async (userId: string, nextStatus: string) => {
    await updateUserStatus(userId, nextStatus);
    await load();
  };

  return (
    <AdminShell title="Foydalanuvchilar" subtitle="Customer, host va admin akkauntlari holati va rollari.">
      <div className="admin-grid">
        <div className="admin-panel" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input style={{ flex: '1 1 280px' }} placeholder="Ism, email yoki username bo'yicha qidiring" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
            {statuses.map((item) => <option key={item} value={item}>{item === 'all' ? 'Barcha statuslar' : item}</option>)}
          </select>
          <button onClick={() => void load()} style={{ border: 'none', borderRadius: 14, padding: '12px 18px', background: 'var(--gradient-brand)', color: 'var(--color-ink)', fontWeight: 800 }}>Yangilash</button>
        </div>

        <div className="admin-panel" style={{ padding: 20 }}>
          {loading ? <div>Yuklanmoqda...</div> : null}
          {error ? <div style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</div> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Aloqa</th>
                  <th>Rollar</th>
                  <th>Status</th>
                  <th>Bronlar</th>
                  <th>Oxirgi kirish</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{[user.first_name, user.last_name].filter(Boolean).join(' ')}</div>
                      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{user.username ? `@${user.username}` : user.id}</div>
                    </td>
                    <td>
                      <div>{user.email || 'Email yo\'q'}</div>
                      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{user.phone || 'Telefon yo\'q'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {user.roles.map((role) => <AdminStatusPill key={role} value={role} />)}
                      </div>
                    </td>
                    <td><AdminStatusPill value={user.status} /></td>
                    <td>{user.total_bookings}</td>
                    <td>{formatDateTime(user.last_login_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['active', 'blocked', 'pending'].map((nextStatus) => (
                          <button
                            key={nextStatus}
                            onClick={() => void handleStatusChange(user.id, nextStatus)}
                            style={{
                              borderRadius: 12,
                              padding: '8px 10px',
                              border: user.status === nextStatus ? 'none' : '1px solid var(--color-line)',
                              background: user.status === nextStatus ? 'var(--gradient-brand)' : 'transparent',
                              color: user.status === nextStatus ? 'var(--color-ink)' : 'var(--color-text)',
                              fontWeight: 700,
                              textTransform: 'capitalize',
                            }}
                          >
                            {nextStatus}
                          </button>
                        ))}
                      </div>
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
