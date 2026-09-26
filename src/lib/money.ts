/**
 * Money helpers. We treat integer **cents** as the source of truth for input
 * and arithmetic (avoids float drift), and only convert to a decimal number at
 * the persistence / display boundary. The Postgres column is numeric(12,2).
 */

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
export const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000.00 ceiling.

/**
 * Parse a user-entered amount string into integer cents.
 * Returns null for anything invalid (empty, 0, negative, >2 decimals, "12.3.4").
 */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;

  const [whole, fraction = ''] = trimmed.split('.');
  const padded = fraction.padEnd(2, '0');
  const cents = Number(whole) * 100 + Number(padded);

  if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

/** Cents → a numeric dollar amount (e.g. 4782 → 47.82) for persistence. */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

/** A numeric dollar amount → integer cents (e.g. 47.82 → 4782). */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Sum dollar amounts without accumulating float error. */
export function sumAmounts(amounts: number[]): number {
  const cents = amounts.reduce((total, amount) => total + amountToCents(amount), 0);
  return centsToAmount(cents);
}

/**
 * Sanitize keystrokes for the amount field: digits and a single dot, at most two
 * decimals. Keeps a trailing dot while typing (e.g. "12.").
 */
export function sanitizeAmountInput(text: string): string {
  let value = text.replace(/[^0-9.]/g, '');
  const firstDot = value.indexOf('.');
  if (firstDot !== -1) {
    const whole = value.slice(0, firstDot);
    const fraction = value.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
    value = `${whole}.${fraction}`;
  }
  return value;
}

/** Format a numeric dollar amount back to an editable string (e.g. 47.8 → "47.80"). */
export function amountToInput(amount: number): string {
  return centsToAmount(amountToCents(amount)).toFixed(2);
}

// One Intl formatter per currency, built lazily and reused.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Pure currency formatter (e.g. 47.82 → "$47.82"). Lives here — with no React
 * dependency — so analytics and other logic modules can build copy without
 * importing UI. `MoneyText` renders through the same helper.
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

// Whole-dollar formatters (no cents) for compact, scannable deltas like "+$269".
const compactCurrencyFormatters = new Map<string, Intl.NumberFormat>();

/** Compact currency without cents (e.g. 269.43 → "$269"). For tight delta copy. */
export function formatCurrencyCompact(amount: number, currency = 'USD'): string {
  let formatter = compactCurrencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    compactCurrencyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

/** Spoken amount for screen readers, e.g. 22.99 → "22 dollars and 99 cents"; 49 → "49 dollars". */
export function describeAmount(amount: number): string {
  const cents = amountToCents(Math.abs(amount));
  const whole = Math.floor(cents / 100);
  const remainder = cents % 100;
  const dollars = `${whole} ${whole === 1 ? 'dollar' : 'dollars'}`;
  if (remainder === 0) return dollars;
  return `${dollars} and ${remainder} ${remainder === 1 ? 'cent' : 'cents'}`;
}
