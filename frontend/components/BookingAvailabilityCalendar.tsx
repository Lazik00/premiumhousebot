'use client';

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
} from '../lib/calendar';
import { useAppPreferences } from '../context/AppPreferencesContext';
import type { BlockedRange } from '../lib/types';

function formatSelectionSummary(startDate: string | null, endDate: string | null, locale: string) {
    if (!startDate && !endDate) return '—';
    const format = (value: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));
    if (startDate && !endDate) return format(startDate);
    return `${format(startDate!)} → ${format(endDate!)}`;
}

export default function BookingAvailabilityCalendar({
    isOpen,
    blockedRanges,
    initialStartDate,
    initialEndDate,
    onClose,
    onApply,
}: {
    isOpen: boolean;
    blockedRanges: BlockedRange[];
    initialStartDate: string;
    initialEndDate: string;
    onClose: () => void;
    onApply: (startDate: string, endDate: string) => void;
}) {
    const { locale, t } = useAppPreferences();
    const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [draftStartDate, setDraftStartDate] = useState<string | null>(initialStartDate || null);
    const [draftEndDate, setDraftEndDate] = useState<string | null>(initialEndDate || null);
    const [error, setError] = useState<string | null>(null);

    const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);
    const monthLabel = useMemo(() => formatMonthLabel(visibleMonth, locale), [locale, visibleMonth]);
    const monthMatrix = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
    const todayKey = formatDateKey(new Date());
    const hasCompleteSelection = Boolean(draftStartDate && draftEndDate);

    useEffect(() => {
        if (!isOpen) return;
        setDraftStartDate(initialStartDate || null);
        setDraftEndDate(initialEndDate || null);
        setError(null);
        if (initialStartDate) {
            const focusedDate = new Date(`${initialStartDate}T00:00:00`);
            setVisibleMonth(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1));
        }
    }, [initialEndDate, initialStartDate, isOpen]);

    if (!isOpen) return null;

    const handleDayClick = (dayKey: string) => {
        if (dayKey < todayKey) return;

        if (!draftStartDate || (draftStartDate && draftEndDate)) {
            if (isNightBlocked(dayKey, blockedRanges)) return;
            setDraftStartDate(dayKey);
            setDraftEndDate(null);
            setError(null);
            return;
        }

        if (dayKey <= draftStartDate) {
            if (isNightBlocked(dayKey, blockedRanges)) return;
            setDraftStartDate(dayKey);
            setDraftEndDate(null);
            setError(null);
            return;
        }

        if (!isCheckoutCandidate(dayKey, draftStartDate, blockedRanges)) {
            setError(t('booking.calendarRangeBlocked'));
            return;
        }

        setDraftEndDate(dayKey);
        setError(null);
    };

    const applySelection = () => {
        if (!draftStartDate || !draftEndDate) return;
        onApply(draftStartDate, draftEndDate);
        onClose();
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 120,
                background: 'rgba(8,6,3,0.74)',
                backdropFilter: 'blur(10px)',
                padding: 'calc(20px + var(--tg-safe-top, 60px)) 12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                overflowY: 'auto',
            }}
        >
            <div
                className="scale-in"
                style={{
                    width: 'min(100%, 460px)',
                    borderRadius: 28,
                    background: 'linear-gradient(180deg, rgba(14,11,8,0.98) 0%, rgba(8,6,3,1) 100%)',
                    border: '1px solid rgba(242,217,162,0.12)',
                    boxShadow: '0 30px 72px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                }}
            >
                <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(242,217,162,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>{t('booking.calendarTitle')}</div>
                            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{t('booking.calendarSubtitle')}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                border: '1px solid rgba(242,217,162,0.12)',
                                background: 'rgba(255,247,232,0.04)',
                                color: 'var(--color-text)',
                                fontSize: 18,
                                cursor: 'pointer',
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ padding: '12px 14px', borderRadius: 16, background: 'rgba(255,247,232,0.035)', border: '1px solid rgba(242,217,162,0.08)' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>{t('search.checkIn')}</div>
                            <div style={{ fontSize: 14, fontWeight: 800 }}>{draftStartDate ? formatSelectionSummary(draftStartDate, null, locale) : '—'}</div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 16, background: 'rgba(255,247,232,0.035)', border: '1px solid rgba(242,217,162,0.08)' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>{t('search.checkOut')}</div>
                            <div style={{ fontSize: 14, fontWeight: 800 }}>{draftEndDate ? formatSelectionSummary(draftEndDate, null, locale) : '—'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                        {[
                            { label: t('booking.calendarAvailable'), background: 'rgba(255,247,232,0.04)', border: 'rgba(242,217,162,0.08)' },
                            { label: t('booking.calendarUnavailable'), background: 'rgba(216,177,100,0.16)', border: 'rgba(216,177,100,0.34)' },
                            { label: t('booking.calendarManualBlock'), background: 'rgba(214,122,97,0.18)', border: 'rgba(214,122,97,0.34)' },
                            { label: t('booking.calendarSelected'), background: 'rgba(242,217,162,0.16)', border: 'rgba(242,217,162,0.34)' },
                        ].map((item) => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-muted)' }}>
                                <span style={{ width: 12, height: 12, borderRadius: 4, background: item.background, border: `1px solid ${item.border}` }} />
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(242,217,162,0.12)', background: 'rgba(255,247,232,0.04)', color: 'var(--color-text)', cursor: 'pointer' }}>←</button>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand-light)' }}>{t('booking.calendarHint')}</div>
                        <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(242,217,162,0.12)', background: 'rgba(255,247,232,0.04)', color: 'var(--color-text)', cursor: 'pointer' }}>→</button>
                    </div>

                    <div style={{ padding: 14, borderRadius: 20, border: '1px solid rgba(242,217,162,0.1)', background: 'rgba(255,247,232,0.02)' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'capitalize', marginBottom: 12 }}>{monthLabel}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                            {weekdayLabels.map((label) => (
                                <div key={label} style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase' }}>{label}</div>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                            {monthMatrix.map((week, weekIndex) => (
                                <div key={`${monthLabel}-${weekIndex}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                                    {week.map((day) => {
                                        const isPast = day.key < todayKey;
                                        const blocked = isNightBlocked(day.key, blockedRanges);
                                        const rangeSource = blockedRanges.find((item) => item.start_date <= day.key && day.key < item.end_date)?.source;
                                        const isSelected = isDateInRange(day.key, draftStartDate, draftEndDate);
                                        const isStart = day.key === draftStartDate;
                                        const isEnd = day.key === draftEndDate;
                                        const canBeCheckout = Boolean(draftStartDate && !draftEndDate && isCheckoutCandidate(day.key, draftStartDate, blockedRanges));

                                        const background = isStart || isEnd
                                            ? 'linear-gradient(135deg, rgba(242,217,162,0.96) 0%, rgba(200,156,85,0.98) 100%)'
                                            : isSelected
                                                ? 'rgba(242,217,162,0.16)'
                                                : blocked
                                                    ? rangeSource === 'manual'
                                                        ? 'rgba(214,122,97,0.18)'
                                                        : 'rgba(216,177,100,0.16)'
                                                    : 'rgba(255,247,232,0.04)';
                                        const border = isStart || isEnd
                                            ? '1px solid rgba(242,217,162,0.98)'
                                            : canBeCheckout
                                                ? '1px dashed rgba(242,217,162,0.48)'
                                                : blocked
                                                    ? rangeSource === 'manual'
                                                        ? '1px solid rgba(214,122,97,0.34)'
                                                        : '1px solid rgba(216,177,100,0.34)'
                                                    : '1px solid rgba(242,217,162,0.08)';

                                        return (
                                            <button
                                                key={day.key}
                                                type="button"
                                                disabled={isPast || (!canBeCheckout && blocked && !isStart && !isEnd)}
                                                onClick={() => handleDayClick(day.key)}
                                                style={{
                                                    minHeight: 42,
                                                    borderRadius: 12,
                                                    border,
                                                    background,
                                                    color: isStart || isEnd ? '#130d08' : day.inCurrentMonth ? 'var(--color-text)' : 'rgba(247,239,222,0.28)',
                                                    fontSize: 13,
                                                    fontWeight: isStart || isEnd ? 900 : 700,
                                                    opacity: isPast ? 0.35 : 1,
                                                    cursor: isPast ? 'not-allowed' : 'pointer',
                                                    position: 'relative',
                                                }}
                                            >
                                                {day.label}
                                                {blocked && rangeSource === 'manual' ? <span style={{ position: 'absolute', bottom: 5, left: '50%', width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, background: 'rgba(214,122,97,0.92)' }} /> : null}
                                                {blocked && rangeSource === 'booking' ? <span style={{ position: 'absolute', bottom: 5, left: '50%', width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, background: 'rgba(216,177,100,0.92)' }} /> : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,247,232,0.03)', border: '1px solid rgba(242,217,162,0.08)' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>{t('booking.calendarSelectedRange')}</div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{formatSelectionSummary(draftStartDate, draftEndDate, locale)}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
                            {draftStartDate && !draftEndDate ? t('booking.calendarCheckoutHint') : t('booking.calendarFreeOnly')}
                        </div>
                    </div>

                    {error ? <div style={{ marginTop: 12, color: 'var(--color-danger)', fontSize: 13 }}>{error}</div> : null}

                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button
                            type="button"
                            onClick={() => {
                                setDraftStartDate(null);
                                setDraftEndDate(null);
                                setError(null);
                            }}
                            style={{
                                flex: 1,
                                padding: '14px 0',
                                borderRadius: 14,
                                border: '1px solid rgba(242,217,162,0.12)',
                                background: 'rgba(255,247,232,0.04)',
                                color: 'var(--color-text)',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {t('booking.calendarClear')}
                        </button>
                        <button
                            type="button"
                            disabled={!hasCompleteSelection}
                            onClick={applySelection}
                            style={{
                                flex: 1.2,
                                padding: '14px 0',
                                borderRadius: 14,
                                border: 'none',
                                background: hasCompleteSelection ? 'var(--gradient-brand)' : 'rgba(255,247,232,0.08)',
                                color: hasCompleteSelection ? 'var(--color-ink-soft)' : 'var(--color-muted)',
                                fontWeight: 800,
                                cursor: hasCompleteSelection ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {t('booking.calendarApply')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
