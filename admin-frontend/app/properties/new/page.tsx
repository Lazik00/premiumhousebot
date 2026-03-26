'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminPropertyForm from '../../../components/AdminPropertyForm';
import AdminShell from '../../../components/AdminShell';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { createProperty, getMetaOptions } from '../../../lib/api';
import type { AdminMetaOptions, AdminPropertyPayload } from '../../../lib/types';

export default function NewPropertyPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [meta, setMeta] = useState<AdminMetaOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const load = async () => {
      try {
        setMeta(await getMetaOptions());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Form ma\'lumotlari yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [authLoading, isAuthenticated]);

  const handleSubmit = async (payload: AdminPropertyPayload) => {
    setSaving(true);
    setError(null);
    try {
      const created = await createProperty(payload);
      router.replace(`/properties/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uy yaratilmadi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Yangi uy" subtitle="Admin panel ichidan yangi listing yaratish va darhol moderatsiyaga yuborish.">
      <div style={{ marginBottom: 18 }}>
        <Link href="/properties" className="admin-button secondary" style={{ textDecoration: 'none' }}>Uylar ro'yxatiga qaytish</Link>
      </div>
      <AdminPropertyForm mode="create" meta={meta} loading={loading} saving={saving} error={error} onSubmit={handleSubmit} />
    </AdminShell>
  );
}
