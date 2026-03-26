export function formatMoney(value: number, currency = 'UZS') {
  if (currency === 'UZS') {
    return `${new Intl.NumberFormat('uz-UZ').format(value)} so'm`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Mavjud emas';
  return new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function fullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Noma\'lum';
}
