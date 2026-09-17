export const HQ_CURRENCY = 'INR';
export const HQ_LOCALE = 'en-IN';

const standardFormatter = new Intl.NumberFormat(HQ_LOCALE, {
  style: 'currency',
  currency: HQ_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const preciseFormatter = new Intl.NumberFormat(HQ_LOCALE, {
  style: 'currency',
  currency: HQ_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a value as Indian Rupees (₹). */
export function formatHqCurrency(value: number, precise = false): string {
  return (precise ? preciseFormatter : standardFormatter).format(value);
}

/** Compact axis labels for charts (₹1.7L, ₹12k). */
export function formatHqCurrencyCompact(value: number): string {
  if (value >= 100_000) {
    const lakhs = value / 100_000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)}L`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `₹${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return `₹${Math.round(value)}`;
}
