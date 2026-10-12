/**
 * Forecast presentation view-model — pure, deterministic derivations for the UI.
 *
 * This NEVER recomputes the forecast; it only re-shapes a `ForecastResult` the
 * engine already produced (grouping events, building chart geometry, choosing
 * copy). Keeping it framework-free means the forecast screen stays a thin
 * renderer and every state it can show is unit-testable without React.
 */

import { centsToAmount } from '@/lib/money';

import type {
  ForecastConfidence,
  ForecastEvent,
  ForecastHorizon,
  ForecastResult,
  ForecastWarning,
} from './types';

/* -------------------------------------------------------------------------- */
/* Horizons                                                                   */
/* -------------------------------------------------------------------------- */

export type ForecastHorizonId = 'days-30' | 'month-end';

export const FORECAST_HORIZONS: { id: ForecastHorizonId; label: string }[] = [
  { id: 'days-30', label: '30 days' },
  { id: 'month-end', label: 'End of month' },
];

export function horizonForId(id: ForecastHorizonId): ForecastHorizon {
  return id === 'month-end' ? { kind: 'end-of-month' } : { kind: 'days', days: 30 };
}

/* -------------------------------------------------------------------------- */
/* Event grouping                                                             */
/* -------------------------------------------------------------------------- */

export type ForecastGroups = {
  /** Scheduled income deposits, chronological. */
  income: ForecastEvent[];
  /** Scheduled recurring expense charges, chronological. */
  recurring: ForecastEvent[];
  /** Total income in the window (positive cents). */
  incomeTotalCents: number;
  /** Total recurring outflow in the window (negative cents). */
  recurringTotalCents: number;
  /** Estimated discretionary spend per day (positive cents). */
  estimatedDailyCents: number;
  /** Number of days the run-rate was applied to. */
  estimatedDays: number;
  /** Total estimated discretionary spend (negative cents). */
  estimatedTotalCents: number;
};

/** Split the engine's events into the three sections the screen shows. */
export function groupForecastEvents(result: ForecastResult): ForecastGroups {
  const income: ForecastEvent[] = [];
  const recurring: ForecastEvent[] = [];
  let estimatedDays = 0;
  let estimatedTotalCents = 0;

  for (const e of result.events) {
    if (e.source === 'declared-income') income.push(e);
    else if (e.source === 'confirmed-recurring') recurring.push(e);
    else if (e.source === 'historical-average') {
      estimatedDays += 1;
      estimatedTotalCents += e.amountCents;
    }
  }

  return {
    income,
    recurring,
    incomeTotalCents: income.reduce((s, e) => s + e.amountCents, 0),
    recurringTotalCents: recurring.reduce((s, e) => s + e.amountCents, 0),
    estimatedDailyCents: result.dailyRunRateCents,
    estimatedDays,
    estimatedTotalCents,
  };
}

/* -------------------------------------------------------------------------- */
/* Chart geometry                                                             */
/* -------------------------------------------------------------------------- */

export type ForecastChartPoint = {
  index: number;
  date: string;
  /** Full projection (scheduled + estimated), in cents. */
  fullCents: number;
  /** Scheduled-commitments-only projection, in cents. */
  scheduledCents: number;
  /** Scheduled events landing on this day (for the scrub tooltip). */
  events: ForecastEvent[];
};

export type ForecastChart = {
  points: ForecastChartPoint[];
  minCents: number;
  maxCents: number;
  /** Starting value (real balance, or 0 for a relative forecast). */
  baselineCents: number;
  /** True when values are absolute balances; false for relative net change. */
  hasBalance: boolean;
};

/**
 * Build the two cumulative series for the chart from the engine output:
 *  • `fullCents`      — the engine's own cumulative line (scheduled + estimated).
 *  • `scheduledCents` — the same line with estimated run-rate removed, i.e. only
 *    committed cash movements. The gap between them is the estimated discretionary
 *    drain. Both are pure re-aggregations of engine events — no new forecasting.
 */
export function buildForecastChart(result: ForecastResult): ForecastChart {
  const hasBalance = result.projectedBalanceCents !== null;

  const points: ForecastChartPoint[] = [];
  // The baseline is the balance at asOf (verified or calculated), 0 when relative.
  const baselineCents = hasBalance ? (result.currentBalanceCents ?? 0) : 0;

  // Scheduled-only delta per date (exclude estimated run-rate events).
  const scheduledDeltaByDate = new Map<string, number>();
  const eventsByDate = new Map<string, ForecastEvent[]>();
  for (const e of result.events) {
    if (e.basis === 'scheduled') {
      scheduledDeltaByDate.set(e.date, (scheduledDeltaByDate.get(e.date) ?? 0) + e.amountCents);
      const bucket = eventsByDate.get(e.date);
      if (bucket) bucket.push(e);
      else eventsByDate.set(e.date, [e]);
    }
  }

  let min = baselineCents;
  let max = baselineCents;
  let scheduledCumulative = baselineCents;

  result.series.forEach((point, index) => {
    scheduledCumulative += scheduledDeltaByDate.get(point.date) ?? 0;
    const fullCents = hasBalance ? (point.projectedBalanceCents as number) : point.netChangeCents;

    points.push({
      index,
      date: point.date,
      fullCents,
      scheduledCents: scheduledCumulative,
      events: eventsByDate.get(point.date) ?? [],
    });

    min = Math.min(min, fullCents, scheduledCumulative);
    max = Math.max(max, fullCents, scheduledCumulative);
  });

  return { points, minCents: min, maxCents: max, baselineCents, hasBalance };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

export function confidenceCopy(confidence: ForecastConfidence): { label: string; description: string } {
  switch (confidence) {
    case 'high':
      return {
        label: 'High confidence',
        description: 'Based on steady spending history and your declared income.',
      };
    case 'medium':
      return {
        label: 'Medium confidence',
        description: 'Usable, but some inputs are uneven or incomplete — treat it as a guide.',
      };
    case 'low':
      return {
        label: 'Low confidence',
        description: 'There isn’t enough history yet for a reliable estimate.',
      };
  }
}

/** Calm, non-technical explanation for each warning. Never hidden by the UI. */
export function warningCopy(warning: ForecastWarning): { title: string; body: string } {
  switch (warning) {
    case 'missing-income':
      return {
        title: 'No income added',
        body: 'This forecast shows spending only. Add income to project your net cash flow.',
      };
    case 'insufficient-history':
      return {
        title: 'Limited history',
        body: 'Estimated spending is based on very little data, so it may be off.',
      };
    case 'irregular-spending':
      return {
        title: 'Uneven spending',
        body: 'Your week-to-week spending varies a lot, so the daily estimate is rough.',
      };
    case 'stale-recurrence':
      return {
        title: 'Recurring may be out of date',
        body: 'A recurring charge looks overdue or incomplete. Review it in Recurring.',
      };
    case 'stale-balance':
      return {
        title: 'Balance isn’t current',
        body: 'Your most recent balance is from an earlier date. Ledger won’t roll it forward — it can’t confirm income arrived or that every expense is recorded — so it’s showing relative cash flow. Enter today’s balance to project your ending balance.',
      };
    case 'no-starting-balance':
      return {
        title: 'No current balance',
        body: 'Showing relative cash flow. Enter a balance to project your ending balance.',
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Balance staleness                                                          */
/* -------------------------------------------------------------------------- */

/** Days beyond which a declared balance is considered stale for projection. */
export const BALANCE_STALE_DAYS = 45;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayOrdinal(dateKey: string): number {
  const m = DATE_ONLY.exec(dateKey);
  if (!m) return NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

export type BalanceStaleness = { daysOld: number; isStale: boolean };

/** How old a balance snapshot is relative to `asOf`, and whether it's stale. */
export function balanceStaleness(
  effectiveDate: string,
  asOf: Date,
  thresholdDays: number = BALANCE_STALE_DAYS
): BalanceStaleness {
  const asOfKey = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}-${String(
    asOf.getDate()
  ).padStart(2, '0')}`;
  const daysOld = Math.max(0, dayOrdinal(asOfKey) - dayOrdinal(effectiveDate));
  return { daysOld, isStale: daysOld > thresholdDays };
}

/* -------------------------------------------------------------------------- */
/* Accessibility summary                                                      */
/* -------------------------------------------------------------------------- */

/** One spoken sentence summarizing the forecast (the chart is supplementary). */
export function forecastA11ySummary(result: ForecastResult, format: (amount: number) => string): string {
  const net = centsToAmount(result.netChangeCents);
  const direction = result.netChangeCents >= 0 ? 'up' : 'down';
  const netPart = `Net cash flow ${direction} ${format(Math.abs(net))} over the period.`;
  const balancePart =
    result.projectedBalanceCents !== null
      ? ` Projected ending balance ${format(centsToAmount(result.projectedBalanceCents))}.`
      : ' No starting balance, showing relative change.';
  return `${netPart}${balancePart}`;
}
