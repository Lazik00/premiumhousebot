'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login muvaffaqiyatsiz tugadi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <img
          src="/admin/brand/logo-full.png"
          alt="Premium House"
          style={{ width: 188, marginBottom: 24, filter: 'brightness(0) saturate(100%) invert(76%) sepia(31%) saturate(896%) hue-rotate(356deg) brightness(96%) contrast(92%)' }}
        />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 0.92, marginBottom: 10 }}>Admin kirishi</div>
        <div style={{ color: 'var(--color-muted)', marginBottom: 22 }}>
          Moderatsiya, bronlar, to'lovlar va host balanslarini boshqarish uchun kiriting.
        </div>

        <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
          <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input type="password" autoComplete="current-password" placeholder="Parol" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>

        {error ? (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 14, background: 'rgba(214, 122, 97, 0.08)', border: '1px solid rgba(214, 122, 97, 0.24)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 16,
            padding: '14px 16px',
            background: 'var(--gradient-brand)',
            color: 'var(--color-ink)',
            fontWeight: 800,
            boxShadow: 'var(--shadow-sm)',
            opacity: submitting ? 0.72 : 1,
          }}
        >
          {submitting ? 'Kirilmoqda...' : 'Admin panelga kirish'}
        </button>
      </form>
    </div>
  );
}
