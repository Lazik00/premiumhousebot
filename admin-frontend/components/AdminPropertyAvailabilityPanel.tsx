'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  buildMonthGrid,
  formatDateKey,
  formatMonthLabel,
  getWeekdayLabels,
  isCheckoutCandidate,
  isDateInRange,
  isNightBlocked,
  parseDateKey,
} from '../lib/calendar';
import {
  createPropertyAvailabilityBlock,
  deletePropertyAvailabilityBlock,
  getPropertyAvailability,
} from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import type { AdminPropertyAvailabilityBlock } from '../lib/types';

function rangeLabel(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return 'Sanalarni kalendardan tanlang';
  return `${formatDate(startDate)} → ${formatDate(endDate)}`;
}

export default function AdminPropertyAvailabilityPanel({ propertyId }: { propertyId: string }) {
  const [blocks, setBlocks] = useState<AdminPropertyAvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [draftEnd, setDraftEnd] = useState<string | null>(null);

  const weekdayLabels = useMemo(() => getWeekdayLabels('uz-UZ'), []);
  const months = useMemo(() => [visibleMonth, addMonths(visibleMonth, 1)], [visibleMonth]);
  const todayKey = formatDateKey(new Date());
  const selectionReady = Boolean(draftStart && draftEnd);
  const manualBlocks = blocks.filter((item) => item.source === 'manual');
  const bookingBlocks = blocks.filter((item) => item.source === 'booking');

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const from = todayKey;
      const until = formatDateKey(addMonths(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 12));
      const response = await getPropertyAvailability(propertyId, { from_date: from, to_date: until });
      setBlocks(response.blocked_ranges);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Band kunlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
  }, [propertyId]);

  const handleDayClick = (dayKey: string) => {
    if (dayKey < todayKey) return;

    if (!draftStart || (draftStart && draftEnd)) {
      if (isNightBlocked(dayKey, blocks)) return;
      setDraftStart(dayKey);
      setDraftEnd(null);
      setError(null);
      return;
    }

    if (dayKey <= draftStart) {
      if (isNightBlocked(dayKey, blocks)) return;
      setDraftStart(dayKey);
      setDraftEnd(null);
      setError(null);
      return;
    }

    if (!isCheckoutCandidate(dayKey, draftStart, blocks)) {
      setError('Tanlangan oralikda band kun bor. Boshqa chiqish sanasini tanlang.');
      return;
    }

    setDraftEnd(dayKey);
    setError(null);
  };

  const handleCreate = async () => {
    if (!draftStart || !draftEnd) return;
    setSaving(true);
    setError(null);
    try {
      await createPropertyAvailabilityBlock(propertyId, {
        start_date: draftStart,
        end_date: draftEnd,
        note: note.trim() || null,
      });
      setDraftStart(null);
      setDraftEnd(null);
      setNote('');
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Band sanalar saqlanmadi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    setDeletingId(blockId);
    setError(null);
    try {
      await deletePropertyAvailabilityBlock(propertyId, blockId);
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Band sanani ochishda xatolik');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-panel" style={{ padding: 20, marginBottom: 18 }}>
      <div className="admin-header-row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="admin-section-title">Band qilish taqvimi</div>
          <div className="admin-section-subtitle">Manual block qo'ying, booking bilan band kunlarni ko'ring va bo'sh oraliklarni boshqaring.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="status-pill blocked">{manualBlocks.length} ta manual block</div>
          <div className="status-pill warning">{bookingBlocks.length} ta booking block</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: 16 }}>
        {[
          { label: 'Bo‘sh', color: 'rgba(255,247,232,0.06)', border: 'rgba(242,217,162,0.12)' },
          { label: 'Booking band', color: 'rgba(216,177,100,0.16)', border: 'rgba(216,177,100,0.34)' },
          { label: 'Manual band', color: 'rgba(214,122,97,0.2)', border: 'rgba(214,122,97,0.34)' },
          { label: 'Tanlangan oralik', color: 'rgba(242,217,162,0.18)', border: 'rgba(242,217,162,0.38)' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-muted)', fontSize: 12 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: item.color, border: `1px solid ${item.border}` }} />
            {item.label}
          </div>
        ))}
      </div>

      <div className="admin-subgrid" style={{ alignItems: 'start', marginBottom: 18 }}>
        <div className="admin-panel" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" className="admin-button secondary" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}>← Oldingi</button>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand-light)' }}>2 oylik ko‘rinish</div>
            <button type="button" className="admin-button secondary" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>Keyingi →</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            {months.map((month) => {
              const matrix = buildMonthGrid(month);
              const monthLabel = formatMonthLabel(month, 'uz-UZ');

              return (
                <div key={monthLabel} style={{ padding: 14, borderRadius: 18, border: '1px solid var(--color-line)', background: 'rgba(0,0,0,0.12)' }}>
                  <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 800, textTransform: 'capitalize' }}>{monthLabel}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                    {weekdayLabels.map((label) => (
                      <div key={label} style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase' }}>{label}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {matrix.map((week, weekIndex) => (
                      <div key={`${monthLabel}-${weekIndex}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                        {week.map((day) => {
                          const blocked = isNightBlocked(day.key, blocks);
                          const inSelectedRange = isDateInRange(day.key, draftStart, draftEnd);
                          const isStart = day.key === draftStart;
                          const isEnd = day.key === draftEnd;
                          const isPast = day.key < todayKey;
                          const source = blocks.find((item) => item.start_date <= day.key && day.key < item.end_date)?.source;
                          const checkoutCandidate = Boolean(draftStart && !draftEnd && isCheckoutCandidate(day.key, draftStart, blocks));

                          const background = isStart || isEnd
                            ? 'linear-gradient(135deg, rgba(242,217,162,0.96) 0%, rgba(200,156,85,0.96) 100%)'
                            : inSelectedRange
                              ? 'rgba(242,217,162,0.16)'
                              : blocked
                                ? source === 'manual'
                                  ? 'rgba(214,122,97,0.18)'
                                  : 'rgba(216,177,100,0.16)'
                                : 'rgba(255,247,232,0.04)';

                          const border = isStart || isEnd
                            ? '1px solid rgba(242,217,162,0.98)'
                            : checkoutCandidate
                              ? '1px dashed rgba(242,217,162,0.58)'
                              : blocked
                                ? source === 'manual'
                                  ? '1px solid rgba(214,122,97,0.34)'
                                  : '1px solid rgba(216,177,100,0.32)'
                                : '1px solid rgba(242,217,162,0.08)';

                          return (
                            <button
                              key={day.key}
                              type="button"
                              disabled={isPast || (!checkoutCandidate && blocked && !isStart && !isEnd)}
                              onClick={() => handleDayClick(day.key)}
                              style={{
                                minHeight: 42,
                                borderRadius: 12,
                                border,
                                background,
                                color: isStart || isEnd ? '#130d08' : day.inCurrentMonth ? 'var(--color-text)' : 'rgba(247,239,222,0.32)',
                                fontWeight: isStart || isEnd ? 900 : 700,
                                fontSize: 13,
                                cursor: isPast ? 'not-allowed' : 'pointer',
                                opacity: isPast ? 0.4 : 1,
                                position: 'relative',
                              }}
                            >
                              {day.label}
                              {source === 'manual' && blocked ? <span style={{ position: 'absolute', bottom: 5, left: '50%', width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, background: 'rgba(214,122,97,0.92)' }} /> : null}
                              {source === 'booking' && blocked ? <span style={{ position: 'absolute', bottom: 5, left: '50%', width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, background: 'rgba(216,177,100,0.92)' }} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-panel" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
          <div className="admin-section-title" style={{ fontSize: 16 }}>Yangi manual block</div>
          <div className="admin-section-subtitle" style={{ marginTop: 4 }}>Boshlanish va chiqish sanasini tanlang. Tanlangan oralik bo‘sh bo‘lsa saqlanadi.</div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 16, border: '1px solid var(--color-line)', background: 'rgba(0,0,0,0.14)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>Tanlangan oralik</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{rangeLabel(draftStart, draftEnd)}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              {draftStart && !draftEnd ? 'Endi chiqish sanasini bosing.' : 'Checkout sanasi band kun boshiga to‘g‘ri kelishi mumkin, ammo oralik ichida band kun bo‘lmasligi kerak.'}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--color-muted)' }}>Izoh</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Masalan: texnik xizmat, VIP rezerv, shaxsiy foydalanish"
              rows={4}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid var(--color-line)',
                background: 'rgba(255,247,232,0.03)',
                color: 'var(--color-text)',
                resize: 'vertical',
              }}
            />
          </div>

          {error ? <div style={{ marginTop: 12, color: 'var(--color-danger)', fontSize: 13 }}>{error}</div> : null}

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className="admin-button secondary" onClick={() => { setDraftStart(null); setDraftEnd(null); setNote(''); setError(null); }}>
              Tozalash
            </button>
            <button type="button" className="admin-button" disabled={!selectionReady || saving} onClick={handleCreate}>
              {saving ? 'Saqlanmoqda...' : 'Band qilish'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-section-title" style={{ fontSize: 16, marginBottom: 12 }}>Mavjud band oraliklar</div>
      {loading ? (
        <div style={{ color: 'var(--color-muted)' }}>Yuklanmoqda...</div>
      ) : blocks.length === 0 ? (
        <div style={{ color: 'var(--color-muted)' }}>Hozircha band oralik yo‘q.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {blocks.map((block, index) => (
            <div
              key={block.id || block.booking_id || `${block.start_date}-${block.end_date}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 16,
                border: '1px solid var(--color-line)',
                background: 'rgba(255,247,232,0.03)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <div className={`status-pill ${block.source === 'manual' ? 'blocked' : 'warning'}`}>
                    {block.source === 'manual' ? 'Manual block' : 'Booking'}
                  </div>
                  {block.booking_code ? (
                    <Link href={`/bookings/${block.booking_id}`} style={{ color: 'var(--color-brand-light)', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                      #{block.booking_code}
                    </Link>
                  ) : null}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                  {formatDate(block.start_date)} → {formatDate(block.end_date)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  {block.note || (block.source === 'manual' ? 'Qo‘lda band qilingan sana oralig‘i' : 'Mavjud bron oralig‘i')}
                </div>
                {block.created_at ? <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>{formatDateTime(block.created_at)}</div> : null}
              </div>

              {block.can_delete && block.id ? (
                <button
                  type="button"
                  className="admin-button secondary"
                  disabled={deletingId === block.id}
                  onClick={() => handleDelete(block.id!)}
                >
                  {deletingId === block.id ? 'Ochilmoqda...' : 'Bandni ochish'}
                </button>
              ) : (
                <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>Delete yo‘q</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
