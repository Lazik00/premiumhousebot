import type { CurrencyCode, LanguageCode } from './types';
import { localeByLanguage } from './i18n';

const uzsSuffix: Record<LanguageCode, string> = {
    uz: "so'm",
    ru: 'сум',
    en: 'UZS',
};

function roundCurrency(amount: number, currency: CurrencyCode): number {
    if (currency === 'UZS') return Math.round(amount);
    return Math.round(amount * 100) / 100;
}

export function normalizeCurrency(value: string | undefined): CurrencyCode {
    return value?.toUpperCase() === 'USD' ? 'USD' : 'UZS';
}

export function convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: CurrencyCode,
    usdToUzsRate: number,
): number {
    const from = normalizeCurrency(fromCurrency);

    if (from === toCurrency) {
        return amount;
    }

    if (from === 'UZS' && toCurrency === 'USD') {
        return amount / usdToUzsRate;
    }

    if (from === 'USD' && toCurrency === 'UZS') {
        return amount * usdToUzsRate;
    }

    return amount;
}

export function formatMoney(
    amount: number,
    currency: CurrencyCode,
    language: LanguageCode,
): string {
    const rounded = roundCurrency(amount, currency);
    const locale = localeByLanguage[language];

    if (currency === 'UZS') {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(rounded)} ${uzsSuffix[language]}`;
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: rounded >= 100 ? 0 : 2,
        maximumFractionDigits: rounded >= 100 ? 0 : 2,
    }).format(rounded);
}

export function getAlternateCurrency(currency: CurrencyCode): CurrencyCode {
    return currency === 'UZS' ? 'USD' : 'UZS';
}

export function getPricePair(
    amount: number,
    baseCurrency: string,
    selectedCurrency: CurrencyCode,
    language: LanguageCode,
    usdToUzsRate: number,
): { primary: string; secondary: string; primaryCurrency: CurrencyCode; secondaryCurrency: CurrencyCode } {
    const primaryCurrency = selectedCurrency;
    const secondaryCurrency = getAlternateCurrency(selectedCurrency);
    const primaryAmount = convertCurrency(amount, baseCurrency, primaryCurrency, usdToUzsRate);
    const secondaryAmount = convertCurrency(amount, baseCurrency, secondaryCurrency, usdToUzsRate);

    return {
        primary: formatMoney(primaryAmount, primaryCurrency, language),
        secondary: formatMoney(secondaryAmount, secondaryCurrency, language),
        primaryCurrency,
        secondaryCurrency,
    };
}
