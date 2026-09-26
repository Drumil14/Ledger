/**
 * Recurring-expense summaries — pure, deterministic totals and copy helpers.
 *
 * No React / Supabase / model calls: everything derives from already-confirmed
 * recurring items. Money is summed in integer **cents** so the monthly total and
 * yearly estimate never drift. The yearly figure is labelled an *estimate* by the
 * UI because subscription prices change.
 */

import { amountToCents, centsToAmount, describeAmount, formatCurrency } from '@/lib/money';
import type { RecurringFrequency } from '@/types/recurring';

export { describeAmount };

/* -------------------------------------------------------------------------- */
/* Labels & phrasing                                                          */
/* -------------------------------------------------------------------------- */

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

/** Title-case label for a frequency, e.g. "Monthly". */
export function frequencyLabel(frequency: RecurringFrequency): string {
  return FREQUENCY_LABELS[frequency];
}

const FREQUENCY_INTERVAL_PHRASES: Record<RecurringFrequency, string> = {
  weekly: 'about a week apart',
  biweekly: 'about two weeks apart',
  monthly: 'about one month apart',
  quarterly: 'about three months apart',
  yearly: 'about a year apart',
};

/** Factual gap phrasing for candidate copy, e.g. "about one month apart". */
export function intervalPhrase(frequency: RecurringFrequency): string {
  return FREQUENCY_INTERVAL_PHRASES[frequency];
}

const FREQUENCY_ADVERBS: Record<RecurringFrequency, string> = {
  weekly: 'approximately weekly',
  biweekly: 'approximately every two weeks',
  monthly: 'approximately monthly',
  quarterly: 'approximately quarterly',
  yearly: 'approximately yearly',
};

/** Adverb form for screen-reader summaries, e.g. "approximately monthly". */
export function frequencyAdverb(frequency: RecurringFrequency): string {
  return FREQUENCY_ADVERBS[frequency];
}

/* -------------------------------------------------------------------------- */
/* Monthly / yearly math                                                      */
/* -------------------------------------------------------------------------- */

/** A confirmed item's contribution to recurring spend. */
export type RecurringAmount = {
  expectedAmount: number | null;
  frequency: RecurringFrequency;
};

/**
 * Normalize one item's amount to its monthly-equivalent, in cents. Weekly and
 * biweekly are scaled by their yearly count / 12; quarterly and yearly are
 * divided down. Monthly passes through unchanged.
 */
export function monthlyEquivalentCents(amountCents: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case 'weekly':
      return Math.round((amountCents * 52) / 12);
    case 'biweekly':
      return Math.round((amountCents * 26) / 12);
    case 'monthly':
      return amountCents;
    case 'quarterly':
      return Math.round(amountCents / 3);
    case 'yearly':
      return Math.round(amountCents / 12);
  }
}

/** Total confirmed recurring spend expressed per month, in dollars. */
export function computeMonthlyRecurringTotal(items: RecurringAmount[]): number {
  const cents = items.reduce((sum, item) => {
    if (item.expectedAmount === null) return sum;
    return sum + monthlyEquivalentCents(amountToCents(item.expectedAmount), item.frequency);
  }, 0);
  return centsToAmount(cents);
}

/**
 * Estimated yearly spend for the confirmed set = monthly total × 12. Labelled an
 * estimate by the UI (prices change).
 */
export function computeAnnualEstimate(monthlyTotal: number): number {
  return centsToAmount(amountToCents(monthlyTotal) * 12);
}

/* -------------------------------------------------------------------------- */
/* Deterministic recurring insights                                           */
/* -------------------------------------------------------------------------- */

export type RecurringInsight = { id: string; text: string };

export type RecurringInsightItem = {
  merchant: string;
  expectedAmount: number | null;
  frequency: RecurringFrequency;
};

/**
 * Plain-language, descriptive observations about *confirmed* recurring expenses.
 * Never prescriptive (no "you should cancel…"), never AI-generated, and never
 * includes possible/ignored items. Deterministic for identical inputs.
 */
export function generateRecurringInsights(
  items: RecurringInsightItem[],
  currency: string
): RecurringInsight[] {
  if (items.length === 0) return [];

  const monthlyTotal = computeMonthlyRecurringTotal(items);
  if (monthlyTotal <= 0) return [];

  const money = (amount: number) => formatCurrency(amount, currency);
  const insights: RecurringInsight[] = [];

  insights.push({
    id: 'recurring-monthly-total',
    text: `You have ${money(monthlyTotal)} in confirmed monthly recurring expenses.`,
  });

  if (items.length >= 2) {
    const annual = computeAnnualEstimate(monthlyTotal);
    insights.push({
      id: 'recurring-annual',
      text: `${listMerchants(items.map((i) => i.merchant))} account for about ${money(
        annual
      )} per year at their current rates.`,
    });
  }

  return insights;
}

/** Join names as "A, B and C" (Oxford-free), capped so copy stays readable. */
function listMerchants(names: string[]): string {
  const capped = names.slice(0, 4);
  if (capped.length === 1) return capped[0];
  const head = capped.slice(0, -1).join(', ');
  const tail = capped[capped.length - 1];
  const suffix = names.length > capped.length ? ' and others' : ` and ${tail}`;
  return names.length > capped.length ? `${head}${suffix}` : `${head} and ${tail}`;
}
