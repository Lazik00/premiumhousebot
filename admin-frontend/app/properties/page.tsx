'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import AdminStatusPill from '../../components/AdminStatusPill';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { listProperties, updatePropertyStatus } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { AdminPropertyRow } from '../../lib/types';

const statuses = ['all', 'draft', 'pending_review', 'active', 'blocked', 'archived'] as const;
const propertyTypes = ['all', 'apartment', 'house', 'villa'] as const;

export default function PropertiesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('all');
  const [propertyType, setPropertyType] = useState<(typeof propertyTypes)[number]>('all');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listProperties({
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        property_type: propertyType === 'all' ? undefined : propertyType,
        limit: 50,
        offset: 0,
      });
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uylar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void load();
  }, [authLoading, isAuthenticated]);

  const handleStatusChange = async (propertyId: string, nextStatus: string) => {
    await updatePropertyStatus(propertyId, nextStatus);
    await load();
  };

  return (
    <AdminShell title="Uylar" subtitle="Listing moderatsiyasi, yangi property yaratish va mavjud uylarni to'liq tahrirlash shu yerda boshqariladi.">
      <div className="admin-grid">
        <div className="admin-panel" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ flex: '1 1 280px' }} placeholder="Sarlavha, address yoki shahar bo'yicha qidirish" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
            {statuses.map((item) => <option key={item} value={item}>{item === 'all' ? 'Barcha statuslar' : item}</option>)}
          </select>
          <select value={propertyType} onChange={(event) => setPropertyType(event.target.value as (typeof propertyTypes)[number])}>
            {propertyTypes.map((item) => <option key={item} value={item}>{item === 'all' ? 'Barcha turlar' : item}</option>)}
          </select>
          <button className="admin-button secondary" onClick={() => void load()}>Yangilash</button>
          <Link href="/properties/new" className="admin-button" style={{ textDecoration: 'none' }}>Yangi uy qo'shish</Link>
        </div>

        <div className="admin-panel" style={{ padding: 20 }}>
          {loading ? <div>Yuklanmoqda...</div> : null}
          {error ? <div style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</div> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Uy</th>
                  <th>Lokatsiya</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Narx</th>
                  <th>Rating</th>
                  <th>Yaratilgan</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <Link href={`/properties/${property.id}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 800 }}>
                        {property.title}
                      </Link>
                      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{property.property_type} • {property.capacity} mehmon</div>
                    </td>
                    <td>{property.city}, {property.region}</td>
                    <td>{property.host_name}</td>
                    <td><AdminStatusPill value={property.status} /></td>
                    <td>{formatMoney(property.price_per_night)}</td>
                    <td>{property.average_rating.toFixed(1)} / {property.review_count}</td>
                    <td>{formatDateTime(property.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link href={`/properties/${property.id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Ochish</Link>
                        {['pending_review', 'active', 'blocked'].map((nextStatus) => (
                          <button
                            key={nextStatus}
                            onClick={() => void handleStatusChange(property.id, nextStatus)}
                            className={`admin-button ${property.status === nextStatus ? '' : 'secondary'}`}
                            style={{ textTransform: 'capitalize', padding: '10px 12px' }}
                          >
                            {nextStatus.replace(/_/g, ' ')}
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
