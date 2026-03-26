'use client';

export default function AdminStatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${value}`}>{value.replace(/_/g, ' ')}</span>;
}
