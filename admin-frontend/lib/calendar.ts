import type { AdminPropertyAvailabilityBlock } from './types';

export interface CalendarDayCell {
  key: string;
  label: number;
  inCurrentMonth: boolean;
}

const MONDAY_INDEX = 1;

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addMonths(base: Date, amount: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + amount, 1);
}

export function startOfMonth(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

export function buildMonthGrid(monthDate: Date): CalendarDayCell[][] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const start = new Date(monthStart);
  const offset = (start.getDay() + 7 - MONDAY_INDEX) % 7;
  start.setDate(start.getDate() - offset);

  const end = new Date(monthEnd);
  const tail = (7 - ((end.getDay() + 7 - MONDAY_INDEX) % 7) - 1 + 7) % 7;
  end.setDate(end.getDate() + tail);

  const weeks: CalendarDayCell[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: CalendarDayCell[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      week.push({
        key: formatDateKey(cursor),
        label: cursor.getDate(),
        inCurrentMonth: cursor.getMonth() === monthDate.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function formatMonthLabel(monthDate: Date, locale = 'uz-UZ'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthDate);
}

export function getWeekdayLabels(locale = 'uz-UZ'): string[] {
  const baseMonday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(baseMonday);
    current.setDate(baseMonday.getDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(current);
  });
}

export function isNightBlocked(dateKey: string, ranges: AdminPropertyAvailabilityBlock[]): boolean {
  return ranges.some((range) => range.start_date <= dateKey && dateKey < range.end_date);
}

export function rangeHasBlockedNights(startDate: string, endDate: string, ranges: AdminPropertyAvailabilityBlock[]): boolean {
  return ranges.some((range) => range.start_date < endDate && range.end_date > startDate);
}

export function isDateInRange(dateKey: string, startDate: string | null, endDate: string | null): boolean {
  if (!startDate || !endDate) return false;
  return startDate <= dateKey && dateKey < endDate;
}

export function isCheckoutCandidate(dateKey: string, startDate: string | null, ranges: AdminPropertyAvailabilityBlock[]): boolean {
  if (!startDate || dateKey <= startDate) return false;
  return !rangeHasBlockedNights(startDate, dateKey, ranges);
}
