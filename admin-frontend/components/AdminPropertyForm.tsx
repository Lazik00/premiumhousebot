'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { uploadPropertyImage } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { AdminMetaOptions, AdminPropertyDetail, AdminPropertyImageInput, AdminPropertyPayload, AdminUploadedImage } from '../lib/types';

const defaultPayload: AdminPropertyPayload = {
  host_id: '',
  region_id: '',
  city_id: '',
  title: '',
  description: '',
  address: '',
  latitude: 41.311081,
  longitude: 69.240562,
  property_type: 'apartment',
  capacity: 2,
  rooms: 1,
  bathrooms: 1,
  price_per_night: 500000,
  currency: 'UZS',
  cancellation_policy: '',
  house_rules: '',
  status: 'draft',
  amenity_ids: [],
  images: [{ image_url: '', object_key: '', is_cover: true, sort_order: 1 }],
};

function detailToPayload(detail: AdminPropertyDetail): AdminPropertyPayload {
  return {
    host_id: detail.host_id,
    region_id: detail.region_id,
    city_id: detail.city_id,
    title: detail.title,
    description: detail.description,
    address: detail.address,
    latitude: detail.latitude,
    longitude: detail.longitude,
    property_type: detail.property_type,
    capacity: detail.capacity,
    rooms: detail.rooms,
    bathrooms: detail.bathrooms,
    price_per_night: detail.price_per_night,
    currency: detail.currency,
    cancellation_policy: detail.cancellation_policy || '',
    house_rules: detail.house_rules || '',
    status: detail.status,
    amenity_ids: detail.amenities.map((item) => item.id),
    images: detail.images.length
      ? detail.images.map((image) => ({
          image_url: image.image_url,
          object_key: image.object_key,
          is_cover: image.is_cover,
          sort_order: image.sort_order,
        }))
      : [{ image_url: '', object_key: '', is_cover: true, sort_order: 1 }],
  };
}

function normalizeImages(images: AdminPropertyImageInput[]) {
  const filtered = images
    .map((image, index) => ({
      image_url: image.image_url.trim(),
      object_key: (image.object_key || '').trim(),
      is_cover: image.is_cover,
      sort_order: image.sort_order || index + 1,
    }))
    .filter((image) => image.image_url.length > 0)
    .map((image, index) => ({
      ...image,
      sort_order: index + 1,
    }));

  if (filtered.length > 0 && !filtered.some((item) => item.is_cover)) {
    filtered[0].is_cover = true;
  }

  return filtered;
}

export default function AdminPropertyForm({
  mode,
  meta,
  initialValue,
  loading,
  saving,
  error,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  meta: AdminMetaOptions | null;
  initialValue?: AdminPropertyDetail | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onSubmit: (payload: AdminPropertyPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<AdminPropertyPayload>(defaultPayload);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialValue ? detailToPayload(initialValue) : defaultPayload);
  }, [initialValue]);

  const cities = useMemo(
    () => (meta?.cities || []).filter((city) => city.region_id === form.region_id),
    [form.region_id, meta?.cities],
  );

  useEffect(() => {
    if (form.city_id && cities.every((city) => city.id !== form.city_id)) {
      setForm((current) => ({ ...current, city_id: '' }));
    }
  }, [cities, form.city_id]);

  const coverImage = form.images.find((item) => item.is_cover && item.image_url.trim()) || form.images.find((item) => item.image_url.trim());
  const selectedHost = meta?.hosts.find((item) => item.id === form.host_id);
  const selectedRegion = meta?.regions.find((item) => item.id === form.region_id);
  const selectedCity = meta?.cities.find((item) => item.id === form.city_id);

  const updateField = <K extends keyof AdminPropertyPayload,>(key: K, value: AdminPropertyPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateImage = (index: number, patch: Partial<AdminPropertyImageInput>) => {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) => (imageIndex === index ? { ...image, ...patch } : image)),
    }));
  };

  const addImage = () => {
    setForm((current) => ({
      ...current,
      images: [
        ...current.images,
        { image_url: '', object_key: '', is_cover: current.images.length === 0, sort_order: current.images.length + 1 },
      ],
    }));
  };

  const removeImage = (index: number) => {
    setForm((current) => {
      const images = current.images.filter((_, imageIndex) => imageIndex !== index);
      if (images.length > 0 && !images.some((image) => image.is_cover)) {
        images[0].is_cover = true;
      }
      return { ...current, images: images.length ? images : [{ image_url: '', object_key: '', is_cover: true, sort_order: 1 }] };
    });
  };

  const toggleAmenity = (amenityId: string) => {
    setForm((current) => ({
      ...current,
      amenity_ids: current.amenity_ids.includes(amenityId)
        ? current.amenity_ids.filter((item) => item !== amenityId)
        : [...current.amenity_ids, amenityId],
    }));
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploadedImages: AdminUploadedImage[] = [];
      for (const file of files) {
        uploadedImages.push(await uploadPropertyImage(file));
      }
      setForm((current) => {
        const hasRealImages = current.images.some((image) => image.image_url.trim());
        const baseImages = hasRealImages ? current.images : [];
        const startSort = baseImages.length;
        return {
          ...current,
          images: [
            ...baseImages,
            ...uploadedImages.map((image, index) => ({
              image_url: image.image_url,
              object_key: image.object_key,
              is_cover: !hasRealImages && index === 0,
              sort_order: startSort + index + 1,
            })),
          ],
        };
      });
      event.target.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Rasm yuklanmadi');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      currency: form.currency.toUpperCase(),
      cancellation_policy: form.cancellation_policy?.trim() || null,
      house_rules: form.house_rules?.trim() || null,
      images: normalizeImages(form.images),
    });
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-panel" style={{ padding: 22 }}>
        <div className="admin-header-row">
          <div>
            <div className="admin-section-title">{mode === 'create' ? 'Yangi uy qo\'shish' : 'Uy ma\'lumotlarini yangilash'}</div>
            <div className="admin-section-subtitle">Host, lokatsiya, rasmlar, amenity va policy maydonlari shu yerda boshqariladi.</div>
          </div>
          <button className="admin-button" type="submit" disabled={saving || loading || !meta}>
            {saving ? 'Saqlanmoqda...' : mode === 'create' ? 'Uyni yaratish' : 'O\'zgarishlarni saqlash'}
          </button>
        </div>

        {error ? <div className="admin-alert danger" style={{ marginTop: 18 }}>{error}</div> : null}
        {loading ? <div style={{ marginTop: 18 }}>Ma'lumotlar yuklanmoqda...</div> : null}

        <div className="admin-form-grid admin-form-grid-2" style={{ marginTop: 18 }}>
          <label className="admin-field">
            <span>Host</span>
            <select value={form.host_id} onChange={(event) => updateField('host_id', event.target.value)} required>
              <option value="">Host tanlang</option>
              {meta?.hosts.map((host) => (
                <option key={host.id} value={host.id}>{host.label}{host.email ? ` • ${host.email}` : ''}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => updateField('status', event.target.value)} required>
              <option value="draft">draft</option>
              <option value="pending_review">pending_review</option>
              <option value="active">active</option>
              <option value="blocked">blocked</option>
              <option value="archived">archived</option>
            </select>
          </label>

          <label className="admin-field">
            <span>Viloyat</span>
            <select value={form.region_id} onChange={(event) => updateField('region_id', event.target.value)} required>
              <option value="">Viloyat tanlang</option>
              {meta?.regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Shahar</span>
            <select value={form.city_id} onChange={(event) => updateField('city_id', event.target.value)} required>
              <option value="">Shahar tanlang</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Mulk turi</span>
            <select value={form.property_type} onChange={(event) => updateField('property_type', event.target.value)} required>
              <option value="apartment">apartment</option>
              <option value="house">house</option>
              <option value="villa">villa</option>
            </select>
          </label>

          <label className="admin-field">
            <span>Valyuta</span>
            <input value={form.currency} onChange={(event) => updateField('currency', event.target.value)} maxLength={3} required />
          </label>
        </div>

        <div className="admin-form-grid" style={{ marginTop: 16 }}>
          <label className="admin-field">
            <span>Sarlavha</span>
            <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Masalan: Chilonzor Premium Apartment" required />
          </label>
          <label className="admin-field">
            <span>Manzil</span>
            <input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Ko'cha, mahalla, mo'ljal" required />
          </label>
          <label className="admin-field">
            <span>Tavsif</span>
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={5} placeholder="Uyning afzalliklari, interyer va qoidalarni yozing" required />
          </label>
        </div>

        <div className="admin-form-grid admin-form-grid-4" style={{ marginTop: 16 }}>
          <label className="admin-field">
            <span>Mehmon sig'imi</span>
            <input type="number" min={1} max={50} value={form.capacity} onChange={(event) => updateField('capacity', Number(event.target.value) || 1)} required />
          </label>
          <label className="admin-field">
            <span>Xonalar</span>
            <input type="number" min={1} max={50} value={form.rooms} onChange={(event) => updateField('rooms', Number(event.target.value) || 1)} required />
          </label>
          <label className="admin-field">
            <span>Hammom</span>
            <input type="number" min={1} max={50} value={form.bathrooms} onChange={(event) => updateField('bathrooms', Number(event.target.value) || 1)} required />
          </label>
          <label className="admin-field">
            <span>Bir kecha narxi</span>
            <input type="number" min={1} step="0.01" value={form.price_per_night} onChange={(event) => updateField('price_per_night', Number(event.target.value) || 0)} required />
          </label>
          <label className="admin-field">
            <span>Latitude</span>
            <input type="number" step="0.000001" value={form.latitude} onChange={(event) => updateField('latitude', Number(event.target.value) || 0)} required />
          </label>
          <label className="admin-field">
            <span>Longitude</span>
            <input type="number" step="0.000001" value={form.longitude} onChange={(event) => updateField('longitude', Number(event.target.value) || 0)} required />
          </label>
        </div>

        <div className="admin-form-grid admin-form-grid-2" style={{ marginTop: 16 }}>
          <label className="admin-field">
            <span>Bekor qilish siyosati</span>
            <textarea value={form.cancellation_policy || ''} onChange={(event) => updateField('cancellation_policy', event.target.value)} rows={4} placeholder="Masalan: 24 soat oldin bekor qilinsa to'liq qaytariladi" />
          </label>
          <label className="admin-field">
            <span>Uy qoidalari</span>
            <textarea value={form.house_rules || ''} onChange={(event) => updateField('house_rules', event.target.value)} rows={4} placeholder="Masalan: chekish mumkin emas, shovqin 23:00 dan keyin taqiqlanadi" />
          </label>
        </div>
      </div>

      <div className="admin-subgrid" style={{ marginTop: 18 }}>
        <div className="admin-panel" style={{ padding: 22 }}>
          <div className="admin-section-title">Qulayliklar</div>
          <div className="admin-chip-grid" style={{ marginTop: 16 }}>
            {meta?.amenities.map((amenity) => {
              const active = form.amenity_ids.includes(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  className={`admin-chip ${active ? 'active' : ''}`}
                  onClick={() => toggleAmenity(amenity.id)}
                >
                  {amenity.name_uz}
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-panel" style={{ padding: 22 }}>
          <div className="admin-section-title">Live preview</div>
          <div className="admin-preview-card" style={{ marginTop: 16 }}>
            {coverImage?.image_url ? <img src={coverImage.image_url} alt={form.title || 'Property preview'} className="admin-preview-image" /> : <div className="admin-preview-empty">Cover image qo'shilmagan</div>}
            <div className="admin-preview-overlay">
              <div className="admin-preview-badge">{selectedCity?.name || 'Shahar tanlanmagan'}</div>
              <div className="admin-preview-title">{form.title || 'Yangi property'}</div>
              <div className="admin-preview-subtitle">{form.address || 'Manzil kiritilmagan'}</div>
              <div className="admin-preview-price">{formatMoney(form.price_per_night || 0, form.currency || 'UZS')}</div>
            </div>
          </div>
          <div className="admin-kv-list" style={{ marginTop: 16 }}>
            <div className="admin-kv"><span>Host</span><strong>{selectedHost?.label || 'Tanlanmagan'}</strong></div>
            <div className="admin-kv"><span>Hudud</span><strong>{selectedRegion?.name || 'Viloyat'} / {selectedCity?.name || 'Shahar'}</strong></div>
            <div className="admin-kv"><span>Sig'im</span><strong>{form.capacity} mehmon</strong></div>
            <div className="admin-kv"><span>Koordinata</span><strong>{form.latitude}, {form.longitude}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <a className="admin-button secondary" href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer">Google Maps</a>
            <a className="admin-button secondary" href={`https://yandex.com/maps/?pt=${form.longitude},${form.latitude}&z=16`} target="_blank" rel="noreferrer">Yandex xarita</a>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ padding: 22, marginTop: 18 }}>
        <div className="admin-header-row">
          <div>
            <div className="admin-section-title">Rasmlar</div>
            <div className="admin-section-subtitle">Fayldan yuklang yoki URL orqali cover va galereya rasmlarini boshqaring.</div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label
              className="admin-button"
              aria-disabled={uploading}
              style={uploading ? { opacity: 0.65, pointerEvents: 'none' } : undefined}
            >
              {uploading ? 'Yuklanmoqda...' : 'Fayldan yuklash'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              />
            </label>
            <button className="admin-button secondary" type="button" onClick={addImage}>Rasm qo'shish</button>
          </div>
        </div>
        {uploadError ? <div className="admin-alert danger" style={{ marginTop: 16 }}>{uploadError}</div> : null}

        <div className="admin-image-grid" style={{ marginTop: 16 }}>
          {form.images.map((image, index) => (
            <div className="admin-image-card" key={`${index}-${image.sort_order}`}>
              <div className="admin-image-thumb">
                {image.image_url.trim() ? <img src={image.image_url} alt={`Property image ${index + 1}`} /> : <span>Preview</span>}
              </div>
              <div className="admin-stack" style={{ gap: 12 }}>
                <label className="admin-field compact">
                  <span>Image URL</span>
                  <input value={image.image_url} onChange={(event) => updateImage(index, { image_url: event.target.value })} placeholder="https://..." />
                </label>
                <label className="admin-field compact">
                  <span>Object key</span>
                  <input value={image.object_key || ''} onChange={(event) => updateImage(index, { object_key: event.target.value })} placeholder="optional/minio-key" />
                </label>
                <div className="admin-form-grid admin-form-grid-2 compact-grid">
                  <label className="admin-field compact">
                    <span>Sort</span>
                    <input type="number" min={1} value={image.sort_order} onChange={(event) => updateImage(index, { sort_order: Number(event.target.value) || index + 1 })} />
                  </label>
                  <div className="admin-field compact">
                    <span>Cover</span>
                    <button className={`admin-button ${image.is_cover ? '' : 'secondary'}`} type="button" onClick={() => setForm((current) => ({ ...current, images: current.images.map((item, itemIndex) => ({ ...item, is_cover: itemIndex === index })) }))}>
                      {image.is_cover ? 'Asosiy rasm' : 'Cover qilish'}
                    </button>
                  </div>
                </div>
                <button className="admin-button danger" type="button" onClick={() => removeImage(index)}>Rasmni olib tashlash</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
