/**
 * Occurrence generation — expand income sources and confirmed recurring expenses
 * into dated `ForecastEvent`s within the forecast window `(fromExclusive, toInclusive]`.
 *
 * Pure and deterministic. All day/month math is delegated to `./dates`, so the
 * day-of-month intent (e.g. the 31st) is preserved across short months and leap
 * years, and nothing drifts with the timezone.
 *
 * The window is left-exclusive, right-inclusive: an occurrence exactly on `asOf`
 * is NOT forecast (it is "today", already past or recorded), while one on the
 * final horizon day IS included.
 */

import { amountToCents } from '@/lib/money';
import type { RecurringExpense } from '@/types/recurring';

import { addDays, addMonthsPreservingDay, compareKeys, dateKeyFromISO } from './dates';
import type { ForecastEvent, ForecastIncomeSource } from './types';

// Safety cap so a pathological anchor far outside the window can't spin forever.
const MAX_OCCURRENCES = 4000;

/** Months to advance per step for the month-based recurring frequencies. */
const MONTH_STEP = { monthly: 1, quarterly: 3, yearly: 12 } as const;

function inWindow(key: string, fromExclusive: string, toInclusive: string): boolean {
  return compareKeys(key, fromExclusive) > 0 && compareKeys(key, toInclusive) <= 0;
}

/**
 * Fixed-day-step series (weekly / biweekly) from an anchor. Occurrences never
 * precede the anchor — income/expenses don't exist before they start — so a past
 * anchor is rolled forward to the first occurrence after `fromExclusive`.
 */
function dayStepSeries(
  anchorKey: string,
  step: number,
  fromExclusive: string,
  toInclusive: string
): string[] {
  const out: string[] = [];
  if (compareKeys(fromExclusive, toInclusive) >= 0) return out;

  let key = anchorKey;
  let guard = 0;
  while (compareKeys(key, fromExclusive) <= 0 && guard < MAX_OCCURRENCES) {
    key = addDays(key, step);
    guard += 1;
  }
  while (compareKeys(key, toInclusive) <= 0 && guard < MAX_OCCURRENCES) {
    out.push(key);
    key = addDays(key, step);
    guard += 1;
  }
  return out;
}

/**
 * Month-based series (monthly / quarterly / yearly) applying `intendedDay` to
 * each target month. Monotonically increasing, so we iterate forward from the
 * base month and stop once past the window.
 */
function monthStepSeries(
  baseYear: number,
  baseMonth1: number,
  stepMonths: number,
  intendedDay: number,
  fromExclusive: string,
  toInclusive: string
): string[] {
  const out: string[] = [];
  if (compareKeys(fromExclusive, toInclusive) >= 0) return out;

  for (let k = 0; k < MAX_OCCURRENCES; k += 1) {
    const key = addMonthsPreservingDay(baseYear, baseMonth1, k * stepMonths, intendedDay);
    if (compareKeys(key, toInclusive) > 0) break;
    if (compareKeys(key, fromExclusive) > 0) out.push(key);
  }
  return out;
}

/** Expand declared income sources into inflow events. */
export function generateIncomeEvents(
  sources: ForecastIncomeSource[],
  fromExclusive: string,
  toInclusive: string
): ForecastEvent[] {
  const events: ForecastEvent[] = [];

  for (const src of sources) {
    const amountCents = src.amountCents;
    if (!Number.isFinite(amountCents) || amountCents <= 0) continue;

    // Clip to the source's active window (inclusive) so income that starts or
    // ends mid-horizon never projects outside its real lifetime.
    const startKey = src.startDate ? dateKeyFromISO(src.startDate) : null;
    const endKey = src.endDate ? dateKeyFromISO(src.endDate) : null;
    const withinActiveWindow = (date: string) =>
      (startKey === null || compareKeys(date, startKey) >= 0) &&
      (endKey === null || compareKeys(date, endKey) <= 0);

    const emit = (date: string) => {
      if (!withinActiveWindow(date)) return;
      events.push({
        date,
        amountCents,
        direction: 'income',
        basis: 'scheduled',
        source: 'declared-income',
        label: src.label,
      });
    };

    const s = src.schedule;
    switch (s.kind) {
      case 'weekly':
      case 'biweekly': {
        const step = s.kind === 'weekly' ? 7 : 14;
        for (const d of dayStepSeries(dateKeyFromISO(s.anchorDate), step, fromExclusive, toInclusive)) {
          emit(d);
        }
        break;
      }
      case 'monthly': {
        // Start from the window's opening month; the day-of-month intent is applied
        // explicitly so e.g. the 31st is preserved and clamped per month.
        const [y, mo] = [Number(fromExclusive.slice(0, 4)), Number(fromExclusive.slice(5, 7))];
        for (const d of monthStepSeries(y, mo, 1, s.dayOfMonth, fromExclusive, toInclusive)) emit(d);
        break;
      }
      case 'one-time': {
        const d = dateKeyFromISO(s.date);
        if (inWindow(d, fromExclusive, toInclusive)) emit(d);
        break;
      }
      case 'custom': {
        for (const raw of s.dates) {
          const d = dateKeyFromISO(raw);
          if (inWindow(d, fromExclusive, toInclusive)) emit(d);
        }
        break;
      }
    }
  }

  return events;
}

/**
 * Expand recurring expenses into outflow events. Only `confirmed` patterns with
 * a usable amount and next date contribute — `possible` / `ignored` (cancelled or
 * inactive) rows and incomplete ones are skipped. A past `nextExpectedDate` is
 * rolled forward from, so a stale-but-still-active pattern still projects.
 */
export function generateRecurringEvents(
  recurring: RecurringExpense[],
  fromExclusive: string,
  toInclusive: string
): ForecastEvent[] {
  const events: ForecastEvent[] = [];

  for (const r of recurring) {
    if (r.status !== 'confirmed') continue;
    if (r.expectedAmount == null || r.nextExpectedDate == null) continue;

    const amountCents = amountToCents(r.expectedAmount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) continue;

    const anchorKey = dateKeyFromISO(r.nextExpectedDate);
    let dates: string[];

    if (r.frequency === 'weekly' || r.frequency === 'biweekly') {
      dates = dayStepSeries(anchorKey, r.frequency === 'weekly' ? 7 : 14, fromExclusive, toInclusive);
    } else {
      const baseYear = Number(anchorKey.slice(0, 4));
      const baseMonth1 = Number(anchorKey.slice(5, 7));
      const intendedDay = Number(anchorKey.slice(8, 10));
      dates = monthStepSeries(
        baseYear,
        baseMonth1,
        MONTH_STEP[r.frequency],
        intendedDay,
        fromExclusive,
        toInclusive
      );
    }

    for (const d of dates) {
      events.push({
        date: d,
        amountCents: -amountCents,
        direction: 'expense',
        basis: 'scheduled',
        source: 'confirmed-recurring',
        label: r.merchant,
      });
    }
  }

  return events;
}
