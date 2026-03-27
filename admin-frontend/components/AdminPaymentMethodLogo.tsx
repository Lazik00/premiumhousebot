import type { CSSProperties } from 'react';

type AdminPaymentMethodLogoProps = {
  brand: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap: Record<NonNullable<AdminPaymentMethodLogoProps['size']>, CSSProperties> = {
  sm: { width: 44, height: 28, borderRadius: 10, padding: '4px 8px' },
  md: { width: 58, height: 36, borderRadius: 12, padding: '6px 10px' },
  lg: { width: 74, height: 44, borderRadius: 14, padding: '8px 12px' },
};

function normalizeBrand(brand: string): 'visa' | 'mastercard' | 'humo' | 'uzcard' | 'generic' {
  const value = brand.trim().toLowerCase();
  if (value === 'visa') return 'visa';
  if (value === 'mastercard') return 'mastercard';
  if (value === 'humo') return 'humo';
  if (value === 'uzcard') return 'uzcard';
  return 'generic';
}

function GenericLogo({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', color: '#c79c42' }}>
      {label.slice(0, 8).toUpperCase()}
    </div>
  );
}

function VisaLogo() {
  return (
    <svg viewBox="0 0 90 28" width="100%" height="100%" aria-hidden="true">
      <text x="6" y="20" fontSize="18" fontWeight="900" fontFamily="Arial, sans-serif" fill="#1A1F71" letterSpacing="0.06em">
        VISA
      </text>
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 120 32" width="100%" height="100%" aria-hidden="true">
      <circle cx="26" cy="16" r="10" fill="#EB001B" />
      <circle cx="40" cy="16" r="10" fill="#F79E1B" fillOpacity="0.92" />
      <path d="M33 8a10 10 0 0 0 0 16a10 10 0 0 0 0-16Z" fill="#FF5F00" />
      <text x="56" y="20" fontSize="12" fontWeight="700" fontFamily="Arial, sans-serif" fill="#19130D">
        mastercard
      </text>
    </svg>
  );
}

function HumoLogo() {
  return (
    <svg viewBox="0 0 120 32" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="adminHumoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#19D58F" />
          <stop offset="52%" stopColor="#10B7E8" />
          <stop offset="100%" stopColor="#3E62FF" />
        </linearGradient>
      </defs>
      <rect x="2" y="7" width="38" height="5" rx="2.5" fill="url(#adminHumoGradient)" />
      <rect x="2" y="14" width="38" height="5" rx="2.5" fill="#31D08C" />
      <rect x="2" y="21" width="38" height="5" rx="2.5" fill="#0FA2FF" />
      <text x="49" y="21" fontSize="15" fontWeight="900" fontFamily="Arial, sans-serif" fill="#19130D" letterSpacing="0.04em">
        HUMO
      </text>
    </svg>
  );
}

function UzcardLogo() {
  return (
    <svg viewBox="0 0 120 32" width="100%" height="100%" aria-hidden="true">
      <rect x="2" y="6" width="34" height="20" rx="5" fill="#1B7846" />
      <rect x="20" y="6" width="16" height="20" rx="5" fill="#00A4E4" />
      <text x="46" y="20" fontSize="14" fontWeight="900" fontFamily="Arial, sans-serif" fill="#19130D" letterSpacing="0.04em">
        UZCARD
      </text>
    </svg>
  );
}

export default function AdminPaymentMethodLogo({ brand, size = 'md' }: AdminPaymentMethodLogoProps) {
  const normalizedBrand = normalizeBrand(brand);
  const baseStyle = sizeMap[size];

  return (
    <div
      style={{
        ...baseStyle,
        flexShrink: 0,
        border: '1px solid rgba(201, 156, 66, 0.16)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,239,224,0.92))',
        boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {normalizedBrand === 'visa' ? <VisaLogo /> : null}
      {normalizedBrand === 'mastercard' ? <MastercardLogo /> : null}
      {normalizedBrand === 'humo' ? <HumoLogo /> : null}
      {normalizedBrand === 'uzcard' ? <UzcardLogo /> : null}
      {normalizedBrand === 'generic' ? <GenericLogo label={brand} /> : null}
    </div>
  );
}
