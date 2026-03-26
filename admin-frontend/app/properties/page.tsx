'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminCombobox, { type AdminComboboxOption } from '../../components/AdminCombobox';
import AdminShell from '../../components/AdminShell';
import AdminStatusPill from '../../components/AdminStatusPill';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getMetaOptions, listProperties, updatePropertyStatus } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import type { AdminMetaOptions, AdminPropertyRow } from '../../lib/types';

const statuses = ['all', 'draft', 'pending_review', 'active', 'blocked', 'archived'] as const;
const propertyTypes = ['all', 'apartment', 'house', 'villa'] as const;

export default function PropertiesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('all');
  const [propertyType, setPropertyType] = useState<(typeof propertyTypes)[number]>('all');
  const [meta, setMeta] = useState<AdminMetaOptions | null>(null);
  const [regionId, setRegionId] = useState('');
  const [cityId, setCityId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cityCountByRegion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const city of meta?.cities || []) {
      counts.set(city.region_id, (counts.get(city.region_id) || 0) + 1);
    }
    return counts;
  }, [meta?.cities]);
  const cityOptionsRaw = useMemo(
    () => (meta?.cities || []).filter((city) => !regionId || city.region_id === regionId),
    [meta?.cities, regionId],
  );
  const regionOptions: AdminComboboxOption[] = useMemo(
    () =>
      (meta?.regions || []).map((region) => ({
        value: region.id,
        label: region.name,
        description: `${cityCountByRegion.get(region.id) || 0} ta shahar / tuman`,
        badge: `${cityCountByRegion.get(region.id) || 0} ta`,
      })),
    [cityCountByRegion, meta?.regions],
  );
  const cityOptions: AdminComboboxOption[] = useMemo(
    () =>
      cityOptionsRaw.map((city) => ({
        value: city.id,
        label: city.name,
        description: city.region_name,
      })),
    [cityOptionsRaw],
  );
  const statusOptions: AdminComboboxOption[] = statuses.map((item) => ({
    value: item,
    label: item === 'all' ? 'Barcha statuslar' : item.replace(/_/g, ' '),
    description: item === 'all' ? 'Draft, active, blocked va boshqa holatlar' : "Status bo'yicha saralash",
  }));
  const propertyTypeOptions: AdminComboboxOption[] = propertyTypes.map((item) => ({
    value: item,
    label: item === 'all' ? 'Barcha turlar' : item,
    description: item === 'all' ? 'Apartment, house va villa' : "Mulk turi bo'yicha saralash",
  }));

  const load = async () => {
    setLoading(true);
    try {
      const response = await listProperties({
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        property_type: propertyType === 'all' ? undefined : propertyType,
        region_id: regionId || undefined,
        city_id: cityId || undefined,
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
    const timer = window.setTimeout(() => {
      void load();
    }, search ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, isAuthenticated, search, status, propertyType, regionId, cityId]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void getMetaOptions()
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : 'Lookup ma\'lumotlar yuklanmadi'));
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (cityId && cityOptionsRaw.every((city) => city.id !== cityId)) {
      setCityId('');
    }
  }, [cityId, cityOptionsRaw]);

  const handleStatusChange = async (propertyId: string, nextStatus: string) => {
    await updatePropertyStatus(propertyId, nextStatus);
    await load();
  };

  return (
    <AdminShell title="Uylar" subtitle="Listing moderatsiyasi, yangi property yaratish va mavjud uylarni to'liq tahrirlash shu yerda boshqariladi.">
      <div className="admin-grid">
        <div className="admin-panel admin-filter-panel" style={{ padding: 20 }}>
          <div className="admin-header-row">
            <div>
              <div className="admin-section-title">Smart filter</div>
              <div className="admin-section-subtitle">Qidiruv, status, mulk turi va hudud bo'yicha listinglarni toraytiring.</div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="admin-button secondary" onClick={() => void load()}>Yangilash</button>
              <Link href="/properties/new" className="admin-button" style={{ textDecoration: 'none' }}>Yangi uy qo'shish</Link>
            </div>
          </div>

          <div className="admin-filter-grid" style={{ marginTop: 18 }}>
            <input
              className="admin-filter-search"
              placeholder="Sarlavha, address yoki shahar bo'yicha qidirish"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <AdminCombobox
              compact
              value={status}
              onChange={(nextValue) => setStatus(nextValue as (typeof statuses)[number])}
              options={statusOptions}
              placeholder="Status"
            />
            <AdminCombobox
              compact
              value={propertyType}
              onChange={(nextValue) => setPropertyType(nextValue as (typeof propertyTypes)[number])}
              options={propertyTypeOptions}
              placeholder="Mulk turi"
            />
            <AdminCombobox
              compact
              value={regionId}
              onChange={(nextValue) => {
                setRegionId(nextValue);
                setCityId('');
              }}
              options={regionOptions}
              placeholder="Viloyat"
              searchPlaceholder="Viloyat qidiring..."
              hint="Barcha viloyatlar"
            />
            <AdminCombobox
              compact
              value={cityId}
              onChange={setCityId}
              options={cityOptions}
              placeholder={regionId ? 'Shahar / tuman' : 'Avval viloyat'}
              searchPlaceholder="Shahar yoki tuman qidiring..."
              disabled={!regionId}
              emptyMessage="Tanlangan viloyat bo'yicha lokatsiya topilmadi"
            />
          </div>
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
                      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{property.property_type} - {property.capacity} mehmon</div>
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
