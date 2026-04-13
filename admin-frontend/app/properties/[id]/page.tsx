'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminChannelSyncPanel from '../../../components/AdminChannelSyncPanel';
import AdminPropertyAvailabilityPanel from '../../../components/AdminPropertyAvailabilityPanel';
import AdminPropertyForm from '../../../components/AdminPropertyForm';
import AdminShell from '../../../components/AdminShell';
import AdminStatusPill from '../../../components/AdminStatusPill';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { getMetaOptions, getProperty, updateProperty } from '../../../lib/api';
import { formatDateTime, formatMoney } from '../../../lib/format';
import type { AdminMetaOptions, AdminPropertyDetail, AdminPropertyPayload } from '../../../lib/types';

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = String(params.id || '');
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [meta, setMeta] = useState<AdminMetaOptions | null>(null);
  const [property, setProperty] = useState<AdminPropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverImage = useMemo(() => property?.images.find((item) => item.is_cover) || property?.images[0], [property]);

  const load = async () => {
    setLoading(true);
    try {
      const [metaResponse, propertyResponse] = await Promise.all([getMetaOptions(), getProperty(propertyId)]);
      setMeta(metaResponse);
      setProperty(propertyResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uy ma\'lumotlari yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || !propertyId) return;
    void load();
  }, [authLoading, isAuthenticated, propertyId]);

  const handleSubmit = async (payload: AdminPropertyPayload) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProperty(propertyId, payload);
      setProperty(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uy saqlanmadi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title={property?.title || 'Uy detail'} subtitle="Listingni to'liq tahrirlash, lokatsiya va media boshqaruvi.">
      <div style={{ marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/properties" className="admin-button secondary" style={{ textDecoration: 'none' }}>Uylar ro'yxatiga qaytish</Link>
        {property ? <Link href={`https://maps.google.com/?q=${property.latitude},${property.longitude}`} target="_blank" rel="noreferrer" className="admin-button secondary" style={{ textDecoration: 'none' }}>Lokatsiyani ochish</Link> : null}
      </div>

      {property ? (
        <>
          <div className="admin-subgrid" style={{ marginBottom: 18 }}>
            <div className="admin-panel" style={{ padding: 20 }}>
              <div className="admin-header-row">
                <div>
                  <div className="admin-section-title">Listing overview</div>
                  <div className="admin-section-subtitle">Status, rating va narx holati.</div>
                </div>
                <AdminStatusPill value={property.status} />
              </div>
              <div className="admin-kv-list" style={{ marginTop: 16 }}>
                <div className="admin-kv"><span>Host</span><strong>{property.host_name}</strong></div>
                <div className="admin-kv"><span>Lokatsiya</span><strong>{property.city}, {property.region}</strong></div>
                <div className="admin-kv"><span>Narx</span><strong>{formatMoney(property.price_per_night, property.currency)}</strong></div>
                <div className="admin-kv"><span>Rating</span><strong>{property.average_rating.toFixed(1)} / {property.review_count}</strong></div>
                <div className="admin-kv"><span>Yaratilgan</span><strong>{formatDateTime(property.created_at)}</strong></div>
                <div className="admin-kv"><span>Yangilangan</span><strong>{formatDateTime(property.updated_at)}</strong></div>
              </div>
            </div>
            <div className="admin-panel" style={{ padding: 20 }}>
              <div className="admin-section-title">Cover preview</div>
              <div className="admin-preview-card" style={{ marginTop: 16 }}>
                {coverImage ? <img src={coverImage.image_url} alt={property.title} className="admin-preview-image" /> : <div className="admin-preview-empty">Cover image mavjud emas</div>}
                <div className="admin-preview-overlay">
                  <div className="admin-preview-badge">{property.city}</div>
                  <div className="admin-preview-title">{property.title}</div>
                  <div className="admin-preview-subtitle">{property.address}</div>
                  <div className="admin-preview-price">{formatMoney(property.price_per_night, property.currency)}</div>
                </div>
              </div>
            </div>
          </div>

          <AdminPropertyAvailabilityPanel propertyId={propertyId} />
          <AdminChannelSyncPanel propertyId={propertyId} />
        </>
      ) : null}

      <AdminPropertyForm mode="edit" meta={meta} initialValue={property} loading={loading} saving={saving} error={error} onSubmit={handleSubmit} />
    </AdminShell>
  );
}
