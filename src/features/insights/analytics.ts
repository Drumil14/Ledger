/**
 * Insights analytics — pure, deterministic spending calculations.
 *
 * This module has NO dependency on React, TanStack Query, or Supabase: every
 * function takes plain data (transactions, a budget status, a fixed `now`) and
 * returns a typed result. That keeps the financial logic reproducible and fully
 * unit-testable, and lets the screen stay a thin renderer.
 *
 * Money is handled in integer **cents** internally (via `@/lib/money`) so month
 * comparisons and shares never accumulate floating-point drift. Percentages are
 * never `Infinity` — when a previous value is 0 we return `null` and the caller
 * shows explanatory copy instead of a nonsensical figure.
 *
 * Deliberately AI-free: nothing here calls a model. AI may later *explain* these
 * already-verified numbers, but it must never produce them.
 */

import {
  amountToCents,
  centsToAmount,
  formatCurrency,
  formatCurrencyCompact,
  sumAmounts,
} from '@/lib/money';
import {
  daysInMonth,
  isCurrentMonth,
  monthKeyFromDate,
  previousMonthKey,
} from '@/lib/month';
import type { BudgetStatus } from '@/features/budgets/summary';
import type { Transaction } from '@/types/transaction';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Direction of a change. `unavailable` = no baseline to compare against. */
export type Direction = 'up' | 'down' | 'same' | 'unavailable';

export type MonthComparison = {
  currentTotal: number;
  previousTotal: number;
  /** Signed: current − previous. */
  differenceAmount: number;
  /** Whole-percent change vs previous, or `null` when previous was 0. */
  differencePercent: number | null;
  direction: Direction;
  previousHadSpending: boolean;
};

export type CategoryTotal = {
  category: string;
  total: number;
  /** Whole-percent share of the month's spending (0–100). */
  percent: number;
  count: number;
};

export type CategoryComparison = {
  category: string;
  currentAmount: number;
  previousAmount: number;
  /** Signed: current − previous. */
  differenceAmount: number;
  differencePercent: number | null;
  direction: Direction;
};

export type SpendingPace = {
  currentSpendToDate: number;
  previousSpendToSameDay: number;
  /** Signed: current − previous. */
  differenceAmount: number;
  differencePercent: number | null;
  direction: Direction;
  /** Day-of-month boundary the comparison was cut at. */
  throughDay: number;
  /** True while the current month is still in progress (partial period). */
  isPartial: boolean;
};

export type Projection = {
  eligible: boolean;
  projected: number | null;
  dailyAverage: number | null;
  daysElapsed: number;
  daysInMonth: number;
};

export type WeekendSpending = {
  weekend: number;
  weekday: number;
  /** Whole-percent of the month's spending that fell on Sat/Sun (0–100). */
  weekendShare: number;
};

export type CumulativePoint = { day: number; value: number };

export type CumulativeSeries = {
  totalDays: number;
  current: CumulativePoint[];
  previous: CumulativePoint[];
};

export type Insight = {
  id: string;
  text: string;
};

/* -------------------------------------------------------------------------- */
/* Small internal helpers                                                     */
/* -------------------------------------------------------------------------- */

function txMonthKey(t: Transaction): string {
  return monthKeyFromDate(new Date(t.date));
}

function txDay(t: Transaction): number {
  return new Date(t.date).getDate();
}

function isWeekend(t: Transaction): boolean {
  const day = new Date(t.date).getDay();
  return day === 0 || day === 6;
}

function sumCents(transactions: Transaction[]): number {
  return transactions.reduce((total, t) => total + amountToCents(t.amount), 0);
}

/** Whole-percent change, or `null` when there is no (non-zero) baseline. */
function percentChange(currentCents: number, previousCents: number): number | null {
  if (previousCents === 0) return null;
  return Math.round(((currentCents - previousCents) / previousCents) * 100);
}

/**
 * Direction of movement between two periods. `unavailable` means there is
 * genuinely nothing to compare (both periods empty); spending appearing from a
 * zero baseline is still a real increase (`up`). Callers that need to gate on a
 * missing baseline use the separate `previousHadSpending` flag / a null percent.
 */
function directionFor(currentCents: number, previousCents: number): Direction {
  if (currentCents === 0 && previousCents === 0) return 'unavailable';
  const diff = currentCents - previousCents;
  if (diff > 0) return 'up';
  if (diff < 0) return 'down';
  return 'same';
}

/* -------------------------------------------------------------------------- */
/* Core queries                                                               */
/* -------------------------------------------------------------------------- */

/** Every transaction whose date falls in the given month key (`YYYY-MM`). */
export function getTransactionsForMonth(
  transactions: Transaction[],
  monthKey: string
): Transaction[] {
  return transactions.filter((t) => txMonthKey(t) === monthKey);
}

/** Total spending for a month, in dollars, using exact cents math. */
export function computeMonthlySpend(transactions: Transaction[], monthKey: string): number {
  return sumAmounts(getTransactionsForMonth(transactions, monthKey).map((t) => t.amount));
}

/**
 * Per-category totals for a month, sorted by amount descending. Only categories
 * with spending are returned (a zero category simply doesn't appear). `percent`
 * is the whole-percent share of the month's total.
 */
export function computeCategoryTotals(
  transactions: Transaction[],
  monthKey: string
): CategoryTotal[] {
  const monthTx = getTransactionsForMonth(transactions, monthKey);
  const totalCents = sumCents(monthTx);

  const byCategory = new Map<string, { cents: number; count: number }>();
  for (const t of monthTx) {
    const entry = byCategory.get(t.category) ?? { cents: 0, count: 0 };
    entry.cents += amountToCents(t.amount);
    entry.count += 1;
    byCategory.set(t.category, entry);
  }

  return Array.from(byCategory.entries())
    .map(([category, { cents, count }]) => ({
      category,
      total: centsToAmount(cents),
      percent: totalCents > 0 ? Math.round((cents / totalCents) * 100) : 0,
      count,
    }))
    .sort(
      (a, b) => amountToCents(b.total) - amountToCents(a.total) || a.category.localeCompare(b.category)
    );
}

/**
 * Category-by-category comparison of the month against the one before it,
 * sorted by the magnitude of change (largest movement first). Includes any
 * category present in either month; `differencePercent` is `null` when the
 * previous month had none of that category.
 */
export function computeCategoryComparison(
  transactions: Transaction[],
  monthKey: string
): CategoryComparison[] {
  const currentTx = getTransactionsForMonth(transactions, monthKey);
  const previousTx = getTransactionsForMonth(transactions, previousMonthKey(monthKey));

  const centsByCategory = (txs: Transaction[]) => {
    const map = new Map<string, number>();
    for (const t of txs) map.set(t.category, (map.get(t.category) ?? 0) + amountToCents(t.amount));
    return map;
  };

  const current = centsByCategory(currentTx);
  const previous = centsByCategory(previousTx);
  const categories = new Set<string>([...current.keys(), ...previous.keys()]);

  return Array.from(categories)
    .map((category) => {
      const currentCents = current.get(category) ?? 0;
      const previousCents = previous.get(category) ?? 0;
      const diffCents = currentCents - previousCents;
      return {
        category,
        currentAmount: centsToAmount(currentCents),
        previousAmount: centsToAmount(previousCents),
        differenceAmount: centsToAmount(diffCents),
        differencePercent: percentChange(currentCents, previousCents),
        direction: directionFor(currentCents, previousCents),
      };
    })
    .sort(
      (a, b) =>
        Math.abs(amountToCents(b.differenceAmount)) - Math.abs(amountToCents(a.differenceAmount)) ||
        a.category.localeCompare(b.category)
    );
}

/**
 * Month total vs the previous month total. Note this is a raw month-to-month
 * comparison; for a still-in-progress month it compares spend-so-far against the
 * *whole* previous month. Use `computeSpendingPace` for the fair same-day view.
 */
export function computeMonthComparison(
  transactions: Transaction[],
  monthKey: string
): MonthComparison {
  const currentCents = sumCents(getTransactionsForMonth(transactions, monthKey));
  const previousCents = sumCents(getTransactionsForMonth(transactions, previousMonthKey(monthKey)));
  const diffCents = currentCents - previousCents;

  return {
    currentTotal: centsToAmount(currentCents),
    previousTotal: centsToAmount(previousCents),
    differenceAmount: centsToAmount(diffCents),
    differencePercent: percentChange(currentCents, previousCents),
    direction: directionFor(currentCents, previousCents),
    previousHadSpending: previousCents > 0,
  };
}

/**
 * "Are you spending faster than last month?" — an apples-to-apples comparison.
 *
 * For the *current* month we compare spend from day 1 through today against the
 * previous month's spend over the same day range (never partial-vs-full). For a
 * historical month, there is no partial period, so it degrades to the full month
 * vs the full previous month.
 */
export function computeSpendingPace(
  transactions: Transaction[],
  monthKey: string,
  now: Date
): SpendingPace {
  const partial = isCurrentMonth(monthKey, now);
  const throughDay = partial ? now.getDate() : daysInMonth(monthKey);
  const previousKey = previousMonthKey(monthKey);

  const withinRange = (t: Transaction) => txDay(t) <= throughDay;

  const currentCents = sumCents(getTransactionsForMonth(transactions, monthKey).filter(withinRange));
  const previousCents = sumCents(
    getTransactionsForMonth(transactions, previousKey).filter(withinRange)
  );
  const diffCents = currentCents - previousCents;

  return {
    currentSpendToDate: centsToAmount(currentCents),
    previousSpendToSameDay: centsToAmount(previousCents),
    differenceAmount: centsToAmount(diffCents),
    differencePercent: percentChange(currentCents, previousCents),
    direction: directionFor(currentCents, previousCents),
    throughDay,
    isPartial: partial,
  };
}

const PROJECTION_MIN_DAYS = 5;
const PROJECTION_MIN_TRANSACTIONS = 3;

/**
 * Simple end-of-month projection for the *current* month only: (spend so far ÷
 * days elapsed) × days in month. Suppressed when there isn't enough of the month
 * or enough activity to say anything meaningful (< 5 days, or < 3 transactions),
 * and never produced for a completed historical month.
 */
export function computeProjection(
  transactions: Transaction[],
  monthKey: string,
  now: Date
): Projection {
  const dim = daysInMonth(monthKey);

  if (!isCurrentMonth(monthKey, now)) {
    return { eligible: false, projected: null, dailyAverage: null, daysElapsed: 0, daysInMonth: dim };
  }

  const monthTx = getTransactionsForMonth(transactions, monthKey);
  const daysElapsed = now.getDate();
  const eligible =
    daysElapsed >= PROJECTION_MIN_DAYS && monthTx.length >= PROJECTION_MIN_TRANSACTIONS;

  if (!eligible) {
    return { eligible: false, projected: null, dailyAverage: null, daysElapsed, daysInMonth: dim };
  }

  const spentCents = sumCents(monthTx);
  const dailyCents = spentCents / daysElapsed;

  return {
    eligible: true,
    projected: centsToAmount(Math.round(dailyCents * dim)),
    dailyAverage: centsToAmount(Math.round(dailyCents)),
    daysElapsed,
    daysInMonth: dim,
  };
}

/** The month's largest transactions, biggest first (default top 5). */
export function getLargestTransactions(
  transactions: Transaction[],
  monthKey: string,
  limit = 5
): Transaction[] {
  return getTransactionsForMonth(transactions, monthKey)
    .slice()
    .sort((a, b) => amountToCents(b.amount) - amountToCents(a.amount))
    .slice(0, limit);
}

/** Weekend (Sat/Sun) vs weekday split for the month, plus the weekend share. */
export function computeWeekendSpending(
  transactions: Transaction[],
  monthKey: string
): WeekendSpending {
  const monthTx = getTransactionsForMonth(transactions, monthKey);
  let weekendCents = 0;
  let weekdayCents = 0;
  for (const t of monthTx) {
    if (isWeekend(t)) weekendCents += amountToCents(t.amount);
    else weekdayCents += amountToCents(t.amount);
  }
  const totalCents = weekendCents + weekdayCents;

  return {
    weekend: centsToAmount(weekendCents),
    weekday: centsToAmount(weekdayCents),
    weekendShare: totalCents > 0 ? Math.round((weekendCents / totalCents) * 100) : 0,
  };
}

/**
 * Cumulative daily spend for the month and the previous month, aligned on
 * day-of-month. Feeds the single restrained chart. The current month's series
 * stops at today; the previous month's is capped to the current month's length
 * so both share one x-axis.
 */
export function computeCumulativeSeries(
  transactions: Transaction[],
  monthKey: string,
  now: Date
): CumulativeSeries {
  const totalDays = daysInMonth(monthKey);
  const previousKey = previousMonthKey(monthKey);
  const throughDay = isCurrentMonth(monthKey, now) ? Math.min(now.getDate(), totalDays) : totalDays;

  const cumulative = (txs: Transaction[], maxDay: number): CumulativePoint[] => {
    const perDay = new Array<number>(maxDay + 1).fill(0);
    for (const t of txs) {
      const day = txDay(t);
      if (day >= 1 && day <= maxDay) perDay[day] += amountToCents(t.amount);
    }
    const points: CumulativePoint[] = [];
    let acc = 0;
    for (let day = 1; day <= maxDay; day += 1) {
      acc += perDay[day];
      points.push({ day, value: centsToAmount(acc) });
    }
    return points;
  };

  return {
    totalDays,
    current: cumulative(getTransactionsForMonth(transactions, monthKey), throughDay),
    previous: cumulative(
      getTransactionsForMonth(transactions, previousKey),
      Math.min(daysInMonth(previousKey), totalDays)
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Deterministic insights                                                     */
/* -------------------------------------------------------------------------- */

// Change thresholds (in cents) below which a difference isn't worth surfacing.
const MONTH_CHANGE_MIN_CENTS = 2500; // $25
const CATEGORY_CHANGE_MIN_CENTS = 2500; // $25
const LARGE_PURCHASE_MIN_CENTS = 5000; // $50 floor for an "unusually large" call
const WEEKEND_SHARE_MIN = 35; // % — above the ~29% a flat 2-of-7 weekend would give

// Kept intentionally short so "Worth noticing" stays scannable, not a paragraph.
const MAX_INSIGHTS = 3;

type Candidate = { priority: number; id: string; text: string };

export type InsightContext = {
  monthKey: string;
  now: Date;
  currency: string;
  /** Short month name, e.g. "September". */
  monthName: string;
  comparison: MonthComparison;
  pace: SpendingPace;
  categoryTotals: CategoryTotal[];
  categoryComparison: CategoryComparison[];
  largest: Transaction[];
  weekend: WeekendSpending;
  budget: BudgetStatus;
  monthSpend: number;
  transactionCount: number;
};

/**
 * Turns already-verified numbers into 3–5 plain-language observations, ranked by
 * usefulness. Every line is backed by a computed figure — nothing here infers a
 * cause or motive, and trivial differences are filtered out by the thresholds
 * above. Deterministic: the same inputs always yield the same insights.
 */
export function generateDeterministicInsights(ctx: InsightContext): Insight[] {
  const {
    currency,
    comparison,
    pace,
    categoryTotals,
    categoryComparison,
    largest,
    weekend,
    budget,
    monthSpend,
    transactionCount,
  } = ctx;

  const isCurrent = pace.isPartial;
  // Full precision for absolute figures; whole dollars for compact deltas.
  const money = (amount: number) => formatCurrency(amount, currency);
  const compact = (amount: number) => formatCurrencyCompact(amount, currency);

  const candidates: Candidate[] = [];

  // 1. Month-over-month change. For the current (partial) month we use the fair
  //    same-day pace so we never compare a partial month against a full one.
  if (isCurrent) {
    const diffCents = amountToCents(pace.differenceAmount);
    if (pace.previousSpendToSameDay > 0 && Math.abs(diffCents) >= MONTH_CHANGE_MIN_CENTS) {
      const sign = pace.direction === 'up' ? '+' : '−';
      candidates.push({
        priority: 10,
        id: 'pace',
        text: `${sign}${compact(Math.abs(pace.differenceAmount))} vs this point last month`,
      });
    }
  } else if (comparison.previousHadSpending) {
    const diffCents = amountToCents(comparison.differenceAmount);
    if (Math.abs(diffCents) >= MONTH_CHANGE_MIN_CENTS) {
      const sign = comparison.direction === 'up' ? '+' : '−';
      candidates.push({
        priority: 10,
        id: 'month-change',
        text: `${sign}${compact(Math.abs(comparison.differenceAmount))} vs the previous month`,
      });
    }
  }

  // 2. Largest category increase vs last month.
  const topIncrease = categoryComparison
    .filter((c) => amountToCents(c.differenceAmount) >= CATEGORY_CHANGE_MIN_CENTS)
    .sort((a, b) => amountToCents(b.differenceAmount) - amountToCents(a.differenceAmount))[0];
  if (topIncrease) {
    candidates.push({
      priority: 20,
      id: 'category-increase',
      text: `${topIncrease.category} +${compact(topIncrease.differenceAmount)} month over month`,
    });
  }

  // 3. Largest category this month.
  const topCategory = categoryTotals[0];
  if (topCategory) {
    candidates.push({
      priority: 25,
      id: 'top-category',
      text: `Largest category: ${topCategory.category} (${money(topCategory.total)})`,
    });
  }

  // 4. Budget status.
  if (budget.hasBudget) {
    if (budget.overBudget && budget.overAmount !== null) {
      candidates.push({
        priority: 30,
        id: 'budget',
        text: `Over budget: ${money(budget.overAmount)}`,
      });
    } else if (budget.remaining !== null) {
      candidates.push({
        priority: 30,
        id: 'budget',
        text: `Budget remaining: ${money(budget.remaining)}`,
      });
    }
  }

  // 5. Unusually large single purchase (well above the month's average).
  const top = largest[0];
  if (top && transactionCount >= 3) {
    const avgCents = amountToCents(monthSpend) / transactionCount;
    const topCents = amountToCents(top.amount);
    if (topCents >= LARGE_PURCHASE_MIN_CENTS && topCents >= avgCents * 2) {
      candidates.push({
        priority: 50,
        id: 'large-purchase',
        text: `Largest purchase: ${top.merchant} (${money(top.amount)})`,
      });
    }
  }

  // 6. Weekend share, when meaningfully above a flat baseline.
  if (monthSpend > 0 && weekend.weekendShare >= WEEKEND_SHARE_MIN) {
    candidates.push({
      priority: 60,
      id: 'weekend',
      text: `Weekends: ${weekend.weekendShare}% of spending`,
    });
  }

  return candidates
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_INSIGHTS)
    .map(({ id, text }) => ({ id, text }));
}
