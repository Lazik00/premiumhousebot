import type { CSSProperties } from 'react';

type PaymentMethodLogoProps = {
    brand: string;
    size?: 'sm' | 'md' | 'lg';
};

const sizeMap: Record<NonNullable<PaymentMethodLogoProps['size']>, CSSProperties> = {
    sm: { width: 54, height: 30, borderRadius: 10, padding: 0 },
    md: { width: 70, height: 38, borderRadius: 12, padding: 0 },
    lg: { width: 88, height: 48, borderRadius: 14, padding: 0 },
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
        <div
            style={{
                width: '100%',
                height: '100%',
                borderRadius: 'inherit',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #1f1710, #100c08)',
                boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
            }}
        >
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', color: '#f4d391' }}>
                {label.slice(0, 8).toUpperCase()}
            </div>
        </div>
    );
}

function BrandImage({ src, alt }: { src: string; alt: string }) {
    return (
        <img
            src={src}
            alt={alt}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
            }}
        />
    );
}

export default function PaymentMethodLogo({ brand, size = 'md' }: PaymentMethodLogoProps) {
    const normalizedBrand = normalizeBrand(brand);
    const baseStyle = sizeMap[size];

    return (
        <div
            style={{
                ...baseStyle,
                flexShrink: 0,
            }}
        >
            {normalizedBrand === 'visa' ? <BrandImage src="/payment_logos/visa.png" alt="Visa" /> : null}
            {normalizedBrand === 'mastercard' ? <BrandImage src="/payment_logos/mastercard.png" alt="Mastercard" /> : null}
            {normalizedBrand === 'humo' ? <BrandImage src="/payment_logos/humo.png" alt="Humo" /> : null}
            {normalizedBrand === 'uzcard' ? <BrandImage src="/payment_logos/uzcard.png" alt="Uzcard" /> : null}
            {normalizedBrand === 'generic' ? <GenericLogo label={brand} /> : null}
        </div>
    );
}
