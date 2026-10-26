// ============================================================
// EventWise AI — Currency Formatting Utilities
// ============================================================

import { Currency } from '../types';

export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar (USD)', symbol: '$' },
  { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (GBP)', symbol: '£' },
  { value: 'INR', label: 'Indian Rupee (INR)', symbol: '₹' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)', symbol: 'CA$' },
  { value: 'AUD', label: 'Australian Dollar (AUD)', symbol: 'A$' },
];

export function formatCurrency(amount: number, currency: Currency | string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export function parseCurrencyInput(raw: string): number | null {
  // Strip currency symbols and commas, parse as float
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_OPTIONS.find((c) => c.value === currency)?.symbol ?? currency;
}
