'use client';

import type { CSSProperties } from 'react';
import { useAppPreferences } from '../context/AppPreferencesContext';
import { getPricePair, normalizeCurrency } from '../lib/price';

interface PriceDisplayProps {
    amount: number;
    baseCurrency?: string;
    primaryStyle?: CSSProperties;
    secondaryStyle?: CSSProperties;
    wrapperStyle?: CSSProperties;
    secondaryPrefix?: string;
    align?: 'left' | 'center' | 'right';
}

export default function PriceDisplay({
    amount,
    baseCurrency = 'UZS',
    primaryStyle,
    secondaryStyle,
    wrapperStyle,
    secondaryPrefix = '~ ',
    align = 'left',
}: PriceDisplayProps) {
    const { language, currency, usdToUzsRate, isHydrated } = useAppPreferences();

    if (!isHydrated) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end', ...wrapperStyle }}>
                <div style={primaryStyle}>...</div>
                <div style={secondaryStyle} />
            </div>
        );
    }

    const pricePair = getPricePair(amount, normalizeCurrency(baseCurrency), currency, language, usdToUzsRate);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end', ...wrapperStyle }}>
            <div style={primaryStyle}>{pricePair.primary}</div>
            <div style={secondaryStyle}>{secondaryPrefix}{pricePair.secondary}</div>
        </div>
    );
}
