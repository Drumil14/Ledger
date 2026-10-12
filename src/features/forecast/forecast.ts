/**
 * Cash-flow forecasting engine — the pure, deterministic entry point.
 *
 * `buildForecast(input)` composes the schedule generators and the run-rate
 * estimator into a dated event list, a daily series, a net change, an optional
 * projected balance, and deterministic confidence + warnings. No React, no
 * Supabase, no clock, no LLM. Money is integer cents throughout.
 *
 * Window convention: the forecast covers `(asOf, horizonEnd]` — the day after
 * `asOf` through the final horizon day inclusive. An empty window (e.g.
 * end-of-month when `asOf` is the last day) yields no events and a net of 0.
 */

import { normalizeMerchant } from '@/features/recurring/detection';
import type { RecurringExpense } from '@/types/recurring';

import {
  addDays,
  compareKeys,
  dateKeyFromISO,
  eachDay,
  lastDayOfMonth,
  ordinal,
  toDateKey,
} from './dates';
import { estimateRunRate, type RunRateEstimate } from './run-rate';
import { generateIncomeEvents, generateRecurringEvents } from './schedule';
import type {
  BalanceBasis,
  ForecastConfidence,
  ForecastEvent,
  ForecastHorizon,
  ForecastInput,
  ForecastPoint,
  ForecastResult,
  ForecastWarning,
} from './types';

const RUN_RATE_LABEL = 'Estimated daily spending';

// Stable source ordering for deterministic event sort within a single day.
const SOURCE_ORDER: Record<ForecastEvent['source'], number> = {
  'declared-income': 0,
  'confirmed-recurring': 1,
  'historical-average': 2,
};

// Stable, user-facing warning order.
const WARNING_ORDER: ForecastWarning[] = [
  'missing-income',
  'insufficient-history',
  'irregular-spending',
  'stale-recurrence',
  'stale-balance',
  'no-starting-balance',
];

type ResolvedBalance = {
  /** The baseline at `asOf`, or null when a projection can't be anchored. */
  currentBalanceCents: number | null;
  basis: BalanceBasis | null;
  /** The declared snapshot's effective date (provenance), or null. */
  asOfDate: string | null;
  /** True when a balance exists but is not current, so it can't anchor a balance. */
  unusable: boolean;
};

/**
 * Establish the balance at `asOf` from a declared snapshot, NEVER treating a past
 * snapshot as today's balance:
 *  • same-day snapshot (its effective date IS `asOf`) → used as-is (`declared`).
 *    The user is stating "today I have X"; that is the one defensible absolute
 *    anchor.
 *  • any other date (earlier OR future-dated) → NOT usable as a current balance.
 *    The snapshot is NOT rolled forward across the gap: scheduled income in the
 *    gap is not known to have been received (Ledger has no income-confirmation
 *    mechanism — income sources are schedules, not receipts), and recorded
 *    expenses are not guaranteed to be a complete record of account activity (no
 *    bank feed). With neither side defensible, rolling forward would imply a known
 *    current balance we cannot stand behind, so the forecast stays relative-only.
 *    The snapshot's date is preserved purely for provenance.
 */
function resolveBalance(input: ForecastInput, asOfKey: string): ResolvedBalance {
  if (!input.balance) {
    return { currentBalanceCents: null, basis: null, asOfDate: null, unusable: false };
  }

  const balanceKey = dateKeyFromISO(input.balance.asOfDate);
  const gapDays = ordinal(asOfKey) - ordinal(balanceKey);

  if (gapDays === 0) {
    return {
      currentBalanceCents: input.balance.amountCents,
      basis: 'declared',
      asOfDate: balanceKey,
      unusable: false,
    };
  }

  return { currentBalanceCents: null, basis: null, asOfDate: balanceKey, unusable: true };
}

/** Last forecast day (inclusive) for the given horizon. */
function resolveHorizonEnd(asOfKey: string, horizon: ForecastHorizon): string {
  if (horizon.kind === 'days') return addDays(asOfKey, horizon.days);
  const year = Number(asOfKey.slice(0, 4));
  const month1 = Number(asOfKey.slice(5, 7));
  const day = lastDayOfMonth(year, month1);
  return `${asOfKey.slice(0, 7)}-${String(day).padStart(2, '0')}`;
}

/** Remove exact-duplicate events (same date, direction, amount, source, label). */
function dedupeEvents(events: ForecastEvent[]): ForecastEvent[] {
  const seen = new Set<string>();
  const out: ForecastEvent[] = [];
  for (const e of events) {
    const key = `${e.date}|${e.direction}|${e.amountCents}|${e.source}|${e.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Chronological, then a fixed tiebreak so identical inputs always sort alike. */
function sortEvents(events: ForecastEvent[]): ForecastEvent[] {
  return [...events].sort(
    (a, b) =>
      compareKeys(a.date, b.date) ||
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      a.label.localeCompare(b.label) ||
      a.amountCents - b.amountCents
  );
}

function buildSeries(
  events: ForecastEvent[],
  horizonStart: string,
  horizonEnd: string,
  currentBalanceCents: number | null
): ForecastPoint[] {
  if (compareKeys(horizonStart, horizonEnd) > 0) return [];

  const byDate = new Map<string, number>();
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amountCents);

  const points: ForecastPoint[] = [];
  let cumulative = 0;
  for (const date of eachDay(horizonStart, horizonEnd)) {
    cumulative += byDate.get(date) ?? 0;
    points.push({
      date,
      netChangeCents: cumulative,
      projectedBalanceCents: currentBalanceCents != null ? currentBalanceCents + cumulative : null,
    });
  }
  return points;
}

function computeWarnings(
  input: ForecastInput,
  confirmed: RecurringExpense[],
  runRate: RunRateEstimate,
  asOfKey: string,
  balance: ResolvedBalance
): ForecastWarning[] {
  const found = new Set<ForecastWarning>();

  if (input.income.length === 0) found.add('missing-income');
  if (runRate.insufficientHistory) found.add('insufficient-history');
  if (runRate.irregular) found.add('irregular-spending');
  // No usable balance: either none was given, or an existing one is too old.
  if (balance.currentBalanceCents == null) {
    found.add(input.balance ? 'stale-balance' : 'no-starting-balance');
  }

  const stale = confirmed.some(
    (r) =>
      r.expectedAmount == null ||
      r.nextExpectedDate == null ||
      compareKeys(dateKeyFromISO(r.nextExpectedDate), asOfKey) < 0
  );
  if (stale) found.add('stale-recurrence');

  return WARNING_ORDER.filter((w) => found.has(w));
}

/**
 * Confidence is purely a data-sufficiency signal:
 *   • `low`    — history too thin to trust the run-rate.
 *   • `medium` — usable history but a material caveat (irregular spend, no income
 *                to net against, or a stale recurring pattern).
 *   • `high`   — enough regular history and no material caveat.
 * A missing balance does NOT lower confidence — it only means the result is
 * relative rather than absolute (it is still a warning).
 */
function computeConfidence(runRate: RunRateEstimate, warnings: ForecastWarning[]): ForecastConfidence {
  if (runRate.insufficientHistory) return 'low';
  const mediumTriggers: ForecastWarning[] = ['irregular-spending', 'missing-income', 'stale-recurrence'];
  if (mediumTriggers.some((w) => warnings.includes(w))) return 'medium';
  return 'high';
}

export function buildForecast(input: ForecastInput): ForecastResult {
  const currency = input.currency ?? 'USD';
  const asOfKey = toDateKey(input.asOf);
  const horizonStart = addDays(asOfKey, 1);
  const horizonEnd = resolveHorizonEnd(asOfKey, input.horizon);
  const hasWindow = compareKeys(horizonStart, horizonEnd) <= 0;

  const confirmed = input.recurring.filter((r) => r.status === 'confirmed');
  const confirmedMerchants = new Set(
    confirmed.map((r) => r.normalizedMerchant || normalizeMerchant(r.merchant))
  );

  const runRate = estimateRunRate(
    input.transactions,
    confirmedMerchants,
    input.asOf,
    input.runRateWindowDays
  );

  const events: ForecastEvent[] = [];
  if (hasWindow) {
    events.push(...generateIncomeEvents(input.income, asOfKey, horizonEnd));
    events.push(...generateRecurringEvents(confirmed, asOfKey, horizonEnd));
    if (runRate.dailyRunRateCents > 0) {
      for (const date of eachDay(horizonStart, horizonEnd)) {
        events.push({
          date,
          amountCents: -runRate.dailyRunRateCents,
          direction: 'expense',
          basis: 'estimated',
          source: 'historical-average',
          label: RUN_RATE_LABEL,
        });
      }
    }
  }

  const balance = resolveBalance(input, asOfKey);

  const sorted = sortEvents(dedupeEvents(events));
  const series = buildSeries(sorted, horizonStart, horizonEnd, balance.currentBalanceCents);
  const netChangeCents = sorted.reduce((sum, e) => sum + e.amountCents, 0);
  const projectedBalanceCents =
    balance.currentBalanceCents != null ? balance.currentBalanceCents + netChangeCents : null;

  const warnings = computeWarnings(input, confirmed, runRate, asOfKey, balance);
  const confidence = computeConfidence(runRate, warnings);

  return {
    asOf: asOfKey,
    horizonStart,
    horizonEnd,
    currency,
    events: sorted,
    series,
    netChangeCents,
    currentBalanceCents: balance.currentBalanceCents,
    balanceBasis: balance.basis,
    balanceAsOfDate: balance.asOfDate,
    projectedBalanceCents,
    dailyRunRateCents: runRate.dailyRunRateCents,
    confidence,
    warnings,
  };
}
