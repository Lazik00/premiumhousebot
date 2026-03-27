'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import AdminStatusPill from '../../components/AdminStatusPill';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { createPaymentMethod, listPaymentMethods, updatePaymentMethod } from '../../lib/api';
import type { AdminPaymentMethod, AdminPaymentMethodPayload } from '../../lib/types';

const brandOptions = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'humo', label: 'Humo' },
  { value: 'uzcard', label: 'Uzcard' },
] as const;

const initialForm: AdminPaymentMethodPayload = {
  brand: 'visa',
  name: '',
  card_holder: '',
  card_number: '',
  instructions: '',
  is_active: true,
  sort_order: 1,
};

function brandLabel(value: string) {
  return brandOptions.find((item) => item.value === value)?.label || value.toUpperCase();
}

function maskCardNumber(value: string) {
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 8) return value;
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} **** ${digits.slice(-4)}`;
}

export default function PaymentMethodsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<AdminPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminPaymentMethodPayload>(initialForm);

  const activeCount = useMemo(() => items.filter((item) => item.is_active).length, [items]);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await listPaymentMethods();
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To\'lov usullari yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void load();
  }, [authLoading, isAuthenticated]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: AdminPaymentMethodPayload = {
        ...form,
        name: form.name.trim(),
        card_holder: form.card_holder.trim(),
        card_number: form.card_number.trim(),
        instructions: form.instructions?.trim() || null,
        sort_order: Number(form.sort_order) || 1,
      };

      if (editingId) {
        await updatePaymentMethod(editingId, payload);
        setSuccess('To\'lov usuli yangilandi');
      } else {
        await createPaymentMethod(payload);
        setSuccess('Yangi to\'lov usuli qo\'shildi');
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'To\'lov usuli saqlanmadi');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (method: AdminPaymentMethod) => {
    setEditingId(method.id);
    setForm({
      brand: method.brand as AdminPaymentMethodPayload['brand'],
      name: method.name,
      card_holder: method.card_holder,
      card_number: method.card_number,
      instructions: method.instructions || '',
      is_active: method.is_active,
      sort_order: method.sort_order,
    });
    setSuccess(null);
    setError(null);
  };

  return (
    <AdminShell title="To'lov usullari" subtitle="Buyer ko'radigan karta rekvizitlari va manual payment oqimini shu yerdan boshqaring.">
      <div className="admin-subgrid" style={{ marginBottom: 18 }}>
        <div className="admin-panel" style={{ padding: 22 }}>
          <div className="admin-section-title">Aktiv to'lov vitrinasi</div>
          <div className="admin-kv-list" style={{ marginTop: 18 }}>
            <div className="admin-kv"><span>Jami usullar</span><strong>{items.length}</strong></div>
            <div className="admin-kv"><span>Aktiv ko'rinayotgan</span><strong>{activeCount}</strong></div>
            <div className="admin-kv"><span>Buyer flow</span><strong>Manual tasdiqlash</strong></div>
          </div>
        </div>

        <div className="admin-panel" style={{ padding: 22 }}>
          <div className="admin-header-row">
            <div>
              <div className="admin-section-title">{editingId ? 'Usulni tahrirlash' : 'Yangi usul qo\'shish'}</div>
              <div className="admin-section-subtitle">Visa, Mastercard, Humo yoki Uzcard rekvizitlarini buyer uchun tayyorlang.</div>
            </div>
            {editingId ? (
              <button type="button" className="admin-button secondary" onClick={resetForm}>Yangi forma</button>
            ) : null}
          </div>

          <form className="admin-form admin-stack" style={{ gap: 14, marginTop: 18 }} onSubmit={submit}>
            <div className="admin-form-grid admin-form-grid-2">
              <label className="admin-field">
                <span>Brand</span>
                <select value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value as AdminPaymentMethodPayload['brand'] }))}>
                  {brandOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Ko'rinadigan nom</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Visa Gold / Korporativ Humo" required />
              </label>
            </div>

            <div className="admin-form-grid admin-form-grid-2">
              <label className="admin-field">
                <span>Karta egasi</span>
                <input value={form.card_holder} onChange={(event) => setForm((current) => ({ ...current, card_holder: event.target.value }))} placeholder="PREMIUM HOUSE MCHJ" required />
              </label>
              <label className="admin-field">
                <span>Karta raqami</span>
                <input value={form.card_number} onChange={(event) => setForm((current) => ({ ...current, card_number: event.target.value }))} placeholder="8600 1234 5678 9012" required />
              </label>
            </div>

            <div className="admin-form-grid admin-form-grid-2">
              <label className="admin-field">
                <span>Sort tartibi</span>
                <input type="number" min={1} value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) || 1 }))} />
              </label>
              <label className="admin-field">
                <span>Holati</span>
                <select value={form.is_active ? 'active' : 'inactive'} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'active' }))}>
                  <option value="active">Aktiv</option>
                  <option value="inactive">Yashirin</option>
                </select>
              </label>
            </div>

            <label className="admin-field">
              <span>Buyer uchun ko'rsatma</span>
              <textarea value={form.instructions || ''} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Pul o'tkazilgach, 'To'lov qildim' tugmasini bosing. Zarur bo'lsa checkout screenshot'ni admin so'raydi." />
            </label>

            {error ? <div className="admin-alert danger">{error}</div> : null}
            {success ? <div className="admin-alert success">{success}</div> : null}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="admin-button" type="submit" disabled={saving}>
                {saving ? 'Saqlanmoqda...' : editingId ? 'Usulni yangilash' : 'Usul qo\'shish'}
              </button>
              {editingId ? (
                <button type="button" className="admin-button secondary" onClick={resetForm} disabled={saving}>
                  Bekor qilish
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <div className="admin-panel" style={{ padding: 22 }}>
        <div className="admin-header-row">
          <div>
            <div className="admin-section-title">Buyerga chiqadigan usullar</div>
            <div className="admin-section-subtitle">Buyer aynan shu tartibda ko'radi va manual payment yuboradi.</div>
          </div>
          <button className="admin-button secondary" type="button" onClick={() => void load()} disabled={loading}>
            Yangilash
          </button>
        </div>

        {loading ? <div style={{ marginTop: 18 }}>Yuklanmoqda...</div> : null}

        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Nom</th>
                <th>Karta</th>
                <th>Holat</th>
                <th>Tartib</th>
                <th>Ko'rsatma</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{brandLabel(item.brand)}</div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 6 }}>{item.brand}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800 }}>{item.name}</div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 6 }}>{item.card_holder}</div>
                  </td>
                  <td><code className="admin-code">{maskCardNumber(item.card_number)}</code></td>
                  <td><AdminStatusPill value={item.is_active ? 'active' : 'blocked'} /></td>
                  <td>{item.sort_order}</td>
                  <td style={{ maxWidth: 320, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                    {item.instructions || 'Ko\'rsatma yo\'q'}
                  </td>
                  <td>
                    <button type="button" className="admin-button secondary" onClick={() => startEdit(item)}>
                      Tahrirlash
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--color-muted)', textAlign: 'center' }}>
                    Hozircha to'lov usuli qo'shilmagan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
