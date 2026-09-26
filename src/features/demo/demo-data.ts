/**
 * Deterministic demo dataset.
 *
 * Everything here is pure and driven by an injected reference date, so the demo
 * always looks correct relative to "now" — no month is hardcoded. Given the same
 * reference date the output is identical every time (no randomness), which keeps
 * the recruiter experience reproducible and makes the generator unit-testable.
 *
 * The shapes returned are the exact same domain types the real Supabase layer
 * maps to (`Transaction`, `Budget`, `RecurringExpense`), so demo data flows
 * through the *same* calculation engines as production data — Home overview,
 * Insights analytics, budget math, and recurring detection all run unchanged.
 */

import { computeNextExpectedDate } from '@/features/recurring/detection';
import { monthKeyFromDate, monthStartISO } from '@/lib/month';
import type { Category } from '@/constants/categories';
import type { RecurringExpense } from '@/types/recurring';
import type { Budget, Transaction } from '@/types/transaction';

export type DemoDataset = {
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringExpense[];
};

/** Monthly budget used for the current (and previous) month. */
export const DEMO_BUDGET_LIMIT = 2500;

const CURRENCY = 'USD';

/** A transaction placed by day-of-month within a specific month slot. */
type MonthSpec = {
  day: number;
  merchant: string;
  category: Category;
  amount: number;
  hour?: number;
};

/** A recent transaction placed by offset (in days) back from "today". */
type RecentSpec = Omit<MonthSpec, 'day'> & { offsetDays: number };

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Local `Date` for a month slot + day-of-month, clamped to the month's length. */
function dateInMonth(year: number, monthIndex: number, day: number, hour: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay), hour, 0, 0, 0);
}

/** Never let demo data be timestamped after "now". */
function clampToRef(date: Date, referenceDate: Date): Date {
  return date.getTime() > referenceDate.getTime() ? referenceDate : date;
}

/* -------------------------------------------------------------------------- */
/* Authored transaction sets                                                  */
/* -------------------------------------------------------------------------- */

// The same four subscriptions recur every month so the deterministic recurring
// detector (2+ monthly occurrences, stable amount) surfaces them naturally.
const SUBSCRIPTIONS: MonthSpec[] = [
  { day: 2, merchant: 'Blink Fitness', category: 'Health', amount: 39.0, hour: 6 },
  { day: 4, merchant: 'Spotify', category: 'Subscriptions', amount: 11.99, hour: 3 },
  { day: 12, merchant: 'Netflix', category: 'Subscriptions', amount: 22.99, hour: 3 },
  { day: 18, merchant: 'Adobe', category: 'Subscriptions', amount: 54.99, hour: 3 },
];

// Current month: authored across the first ~20 days. Recent days are driven
// separately (see RECENT) so the Home chart is always lively near "today".
// Dining is intentionally a touch higher and Shopping a touch lower than the
// previous month, so Insights derives real "what changed" deltas.
const CURRENT_FIXED: MonthSpec[] = [
  ...SUBSCRIPTIONS,
  { day: 3, merchant: 'NJ Transit', category: 'Transport', amount: 34.0, hour: 8 },
  { day: 5, merchant: "Trader Joe's", category: 'Groceries', amount: 82.6, hour: 18 },
  { day: 6, merchant: 'Chipotle', category: 'Dining', amount: 13.4, hour: 13 },
  { day: 7, merchant: 'Delta', category: 'Travel', amount: 398.0, hour: 11 },
  { day: 9, merchant: 'Electric bill', category: 'Bills', amount: 138.5, hour: 9 },
  { day: 10, merchant: 'Uniqlo', category: 'Shopping', amount: 96.4, hour: 16 },
  { day: 11, merchant: 'Uber', category: 'Transport', amount: 21.6, hour: 22 },
  { day: 13, merchant: 'Whole Foods', category: 'Groceries', amount: 124.0, hour: 19 },
  { day: 14, merchant: 'Chipotle', category: 'Dining', amount: 15.75, hour: 12 },
  { day: 15, merchant: 'AMC', category: 'Entertainment', amount: 28.5, hour: 20 },
  { day: 16, merchant: 'CVS', category: 'Health', amount: 18.75, hour: 17 },
  { day: 17, merchant: 'Apple', category: 'Shopping', amount: 249.0, hour: 14 },
  { day: 19, merchant: 'Chipotle', category: 'Dining', amount: 12.1, hour: 13 },
  { day: 20, merchant: 'Whole Foods', category: 'Groceries', amount: 58.9, hour: 18 },
];

// Recent activity, relative to today, that shapes the trailing-7-day chart:
// one clearly higher day (offset 1), and gaps at offsets 2 and 4 for
// zero-spend days. Items outside the current month are dropped by the generator.
const RECENT: RecentSpec[] = [
  { offsetDays: 0, merchant: 'Chipotle', category: 'Dining', amount: 12.85, hour: 13 },
  { offsetDays: 1, merchant: 'Whole Foods', category: 'Groceries', amount: 118.4, hour: 18 },
  { offsetDays: 1, merchant: 'Uber', category: 'Transport', amount: 19.3, hour: 21 },
  { offsetDays: 3, merchant: "Trader Joe's", category: 'Groceries', amount: 47.3, hour: 17 },
  { offsetDays: 5, merchant: 'Target', category: 'Shopping', amount: 104.6, hour: 15 },
  { offsetDays: 6, merchant: 'CVS', category: 'Health', amount: 14.2, hour: 10 },
];

// Previous month: a full month. Dining lower and Shopping higher than the
// current month so month-over-month insights are meaningful.
const PREVIOUS: MonthSpec[] = [
  ...SUBSCRIPTIONS,
  { day: 3, merchant: 'NJ Transit', category: 'Transport', amount: 34.0, hour: 8 },
  { day: 5, merchant: "Trader Joe's", category: 'Groceries', amount: 55.1, hour: 18 },
  { day: 7, merchant: 'Delta', category: 'Travel', amount: 214.0, hour: 11 },
  { day: 8, merchant: 'Chipotle', category: 'Dining', amount: 12.4, hour: 13 },
  { day: 9, merchant: 'Electric bill', category: 'Bills', amount: 88.2, hour: 9 },
  { day: 10, merchant: 'Uniqlo', category: 'Shopping', amount: 118.9, hour: 16 },
  { day: 13, merchant: 'Whole Foods', category: 'Groceries', amount: 64.3, hour: 19 },
  { day: 14, merchant: 'Whole Foods', category: 'Groceries', amount: 46.2, hour: 19 },
  { day: 15, merchant: 'CVS', category: 'Health', amount: 34.5, hour: 17 },
  { day: 16, merchant: 'Uber', category: 'Transport', amount: 22.6, hour: 22 },
  { day: 17, merchant: 'Apple', category: 'Shopping', amount: 289.0, hour: 14 },
  { day: 19, merchant: 'Chipotle', category: 'Dining', amount: 13.1, hour: 13 },
  { day: 20, merchant: 'AMC', category: 'Entertainment', amount: 32.0, hour: 20 },
  { day: 21, merchant: 'NJ Transit', category: 'Transport', amount: 34.0, hour: 8 },
  { day: 22, merchant: "Trader Joe's", category: 'Groceries', amount: 62.3, hour: 18 },
  { day: 24, merchant: 'Target', category: 'Shopping', amount: 142.4, hour: 15 },
  { day: 26, merchant: 'Whole Foods', category: 'Groceries', amount: 118.4, hour: 19 },
  { day: 27, merchant: "Trader Joe's", category: 'Groceries', amount: 48.75, hour: 19 },
];

// Two months ago: enough history that subscriptions have three occurrences
// (stronger detection) plus some everyday spend.
const TWO_MONTHS_AGO: MonthSpec[] = [
  ...SUBSCRIPTIONS,
  { day: 3, merchant: 'NJ Transit', category: 'Transport', amount: 34.0, hour: 8 },
  { day: 6, merchant: "Trader Joe's", category: 'Groceries', amount: 52.4, hour: 18 },
  { day: 9, merchant: 'Chipotle', category: 'Dining', amount: 14.2, hour: 13 },
  { day: 9, merchant: 'Electric bill', category: 'Bills', amount: 90.1, hour: 9 },
  { day: 11, merchant: 'Uniqlo', category: 'Shopping', amount: 45.0, hour: 16 },
  { day: 14, merchant: 'Whole Foods', category: 'Groceries', amount: 60.1, hour: 19 },
  { day: 17, merchant: 'Uber', category: 'Transport', amount: 16.8, hour: 22 },
];

/* -------------------------------------------------------------------------- */
/* Generation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build the full demo dataset relative to `referenceDate` (defaults to now).
 * Deterministic: no randomness, ids assigned in a stable order.
 */
export function generateDemoDataset(referenceDate: Date = new Date()): DemoDataset {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const todayDom = referenceDate.getDate();

  let seq = 0;
  const nextId = () => `demo-tx-${String(seq++).padStart(3, '0')}`;

  const transactions: Transaction[] = [];

  const pushMonth = (specs: MonthSpec[], monthOffset: number, onlyUpToToday: boolean) => {
    for (const spec of specs) {
      // Only past/current-day items for the current month, so nothing is dated
      // in the future.
      if (onlyUpToToday && spec.day > todayDom) continue;
      const date = clampToRef(dateInMonth(year, month + monthOffset, spec.day, spec.hour ?? 12), referenceDate);
      transactions.push({
        id: nextId(),
        amount: spec.amount,
        currency: CURRENCY,
        merchant: spec.merchant,
        category: spec.category,
        date: date.toISOString(),
        sourceType: 'manual',
      });
    }
  };

  // Current month (fixed days up to today), then previous and two-months-ago.
  pushMonth(CURRENT_FIXED, 0, true);

  // Recent, offset-based items — kept only when they land inside the current month.
  for (const spec of RECENT) {
    const raw = new Date(year, month, todayDom - spec.offsetDays, spec.hour ?? 12, 0, 0, 0);
    if (raw.getFullYear() !== year || raw.getMonth() !== month) continue;
    const d = clampToRef(raw, referenceDate);
    transactions.push({
      id: nextId(),
      amount: spec.amount,
      currency: CURRENCY,
      merchant: spec.merchant,
      category: spec.category,
      date: d.toISOString(),
      sourceType: 'manual',
    });
  }

  pushMonth(PREVIOUS, -1, false);
  pushMonth(TWO_MONTHS_AGO, -2, false);

  // Newest first, matching the real service's ordering.
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentKey = monthKeyFromDate(referenceDate);
  const previousKey = monthKeyFromDate(new Date(year, month - 1, 1));

  const budgets: Budget[] = [
    { id: 'demo-budget-current', month: monthStartISO(currentKey), limit: DEMO_BUDGET_LIMIT, currency: CURRENCY },
    { id: 'demo-budget-previous', month: monthStartISO(previousKey), limit: DEMO_BUDGET_LIMIT, currency: CURRENCY },
  ];

  const recurring = buildRecurring(year, month);

  return { transactions, budgets, recurring };
}

/**
 * Seed confirmed recurring decisions for Spotify, Netflix, and the gym. Adobe is
 * intentionally left undecided so the detector surfaces it as a live candidate.
 * Amounts/next-dates go through the real `computeNextExpectedDate` helper.
 */
function buildRecurring(year: number, month: number): RecurringExpense[] {
  const confirmed: { merchant: string; normalized: string; amount: number; day: number }[] = [
    { merchant: 'Spotify', normalized: 'spotify', amount: 11.99, day: 4 },
    { merchant: 'Netflix', normalized: 'netflix', amount: 22.99, day: 12 },
    { merchant: 'Blink Fitness', normalized: 'blink fitness', amount: 39.0, day: 2 },
  ];

  return confirmed.map((c, index) => {
    const lastDate = dateInMonth(year, month, c.day, 6).toISOString();
    return {
      id: `demo-recurring-${index}`,
      merchant: c.merchant,
      normalizedMerchant: c.normalized,
      expectedAmount: c.amount,
      frequency: 'monthly',
      nextExpectedDate: computeNextExpectedDate(lastDate, 'monthly'),
      status: 'confirmed',
      source: 'detected',
      lastDetectedAt: lastDate,
    };
  });
}
