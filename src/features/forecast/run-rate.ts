/**
 * Discretionary spending run-rate — a transparent, deterministic estimate of
 * future non-recurring daily spend from recent history.
 *
 * Methodology (fully explainable, no model):
 *   1. Look back over a trailing window ending the day BEFORE `asOf` (today's
 *      partial spend is excluded so it can't bias the rate).
 *   2. Drop any transaction whose normalized merchant matches a CONFIRMED
 *      recurring pattern — those are projected separately by the schedule, so
 *      counting them here too would double-count them.
 *   3. run-rate = total remaining spend ÷ history days, where history days spans
 *      from the earliest counted transaction (bounded by the window) through
 *      yesterday. Dividing by the actual covered span — not a fixed 90 — avoids
 *      understating the rate for users with only a little history.
 *
 * Irregularity is measured at the weekly level (daily buckets are dominated by
 * zero days): the coefficient of variation of weekly totals. A high CV means the
 * run-rate is a weak predictor, which the caller surfaces as a warning rather
 * than as false precision.
 */

import { amountToCents } from '@/lib/money';
import { normalizeMerchant } from '@/features/recurring/detection';
import type { Transaction } from '@/types/transaction';

import { addDays, compareKeys, dateKeyFromISO, daysInclusive, ordinal, toDateKey } from './dates';

export const DEFAULT_RUN_RATE_WINDOW_DAYS = 90;
/** Below either threshold, history is too thin for a trustworthy rate. */
export const MIN_HISTORY_DAYS = 14;
export const MIN_HISTORY_TRANSACTIONS = 3;
/** Weekly coefficient-of-variation above which spending is called irregular. */
export const IRREGULAR_CV_THRESHOLD = 0.75;

const DAYS_PER_WEEK = 7;
const MIN_WEEKS_FOR_IRREGULARITY = 3;

export interface RunRateEstimate {
  /** Estimated discretionary spend per day, in cents (always ≥ 0). */
  dailyRunRateCents: number;
  /** Days of history the rate was averaged over. */
  historyDays: number;
  /** Count of non-recurring transactions counted. */
  transactionCount: number;
  /** True when weekly spend varies too much for the rate to be reliable. */
  irregular: boolean;
  /** True when there is too little history to trust the rate. */
  insufficientHistory: boolean;
}

/**
 * @param transactions          Full history.
 * @param confirmedMerchants    Normalized merchant keys of confirmed recurring
 *                              patterns, excluded to prevent double counting.
 * @param asOf                   The "present" instant (injected; not the clock).
 * @param windowDays             Trailing look-back length. Defaults to 90.
 */
export function estimateRunRate(
  transactions: Transaction[],
  confirmedMerchants: Set<string>,
  asOf: Date,
  windowDays: number = DEFAULT_RUN_RATE_WINDOW_DAYS
): RunRateEstimate {
  const asOfKey = toDateKey(asOf);
  const lastDay = addDays(asOfKey, -1); // yesterday — exclude today's partial spend
  const windowStart = addDays(asOfKey, -windowDays);

  const counted = transactions.filter((t) => {
    const k = dateKeyFromISO(t.date);
    if (compareKeys(k, windowStart) < 0) return false;
    if (compareKeys(k, lastDay) > 0) return false; // excludes today and the future
    return !confirmedMerchants.has(normalizeMerchant(t.merchant));
  });

  const transactionCount = counted.length;
  if (transactionCount === 0) {
    return {
      dailyRunRateCents: 0,
      historyDays: 0,
      transactionCount: 0,
      irregular: false,
      insufficientHistory: true,
    };
  }

  let totalCents = 0;
  let earliestKey = lastDay;
  for (const t of counted) {
    totalCents += amountToCents(t.amount);
    const k = dateKeyFromISO(t.date);
    if (compareKeys(k, earliestKey) < 0) earliestKey = k;
  }

  const historyDays = Math.max(1, daysInclusive(earliestKey, lastDay));
  const dailyRunRateCents = Math.round(totalCents / historyDays);
  const insufficientHistory =
    historyDays < MIN_HISTORY_DAYS || transactionCount < MIN_HISTORY_TRANSACTIONS;
  const irregular = isIrregular(counted, lastDay);

  return { dailyRunRateCents, historyDays, transactionCount, irregular, insufficientHistory };
}

/** Coefficient of variation of weekly spend totals vs the irregularity threshold. */
function isIrregular(counted: Transaction[], lastDay: string): boolean {
  const lastOrd = ordinal(lastDay);
  const weekTotals = new Map<number, number>();
  let maxWeek = 0;

  for (const t of counted) {
    const weekIndex = Math.floor((lastOrd - ordinal(dateKeyFromISO(t.date))) / DAYS_PER_WEEK);
    weekTotals.set(weekIndex, (weekTotals.get(weekIndex) ?? 0) + amountToCents(t.amount));
    if (weekIndex > maxWeek) maxWeek = weekIndex;
  }

  const weeks = maxWeek + 1;
  if (weeks < MIN_WEEKS_FOR_IRREGULARITY) return false;

  const totals: number[] = [];
  for (let i = 0; i < weeks; i += 1) totals.push(weekTotals.get(i) ?? 0);

  const mean = totals.reduce((a, b) => a + b, 0) / weeks;
  if (mean <= 0) return false;

  const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / weeks;
  const cv = Math.sqrt(variance) / mean;
  return cv > IRREGULAR_CV_THRESHOLD;
}
