'use client';

export default function AdminMetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneColor = tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-brand-light)';
  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ color: 'var(--color-muted)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: toneColor }}>{value}</div>
    </div>
  );
}
