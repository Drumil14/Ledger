/**
 * Pure notification logic — dates, copy, ids, and the budget-threshold engine.
 *
 * No Expo / React / Supabase imports: every function is deterministic and takes
 * plain inputs, so all the tricky bits (timezone-correct reminder dates, month
 * boundaries, "notify once per threshold") are exhaustively unit-testable. The
 * service layer (`src/services/notifications.ts`) applies these results via Expo.
 *
 * Times are built with the local-time `Date` constructor, never UTC strings, so a
 * "9 AM" reminder actually fires at 9 AM in the user's timezone.
 */

import { amountToCents, formatCurrency } from '@/lib/money';
import type {
  NotificationKind,
  NotificationRoute,
  RecurringLeadDays,
} from './types';

/** Local hour reminders/summaries fire at. */
export const REMINDER_HOUR = 9;

/** Budget thresholds, ascending. Each fires at most once per month. */
export const BUDGET_THRESHOLDS = [75, 90, 100] as const;

export type NotificationContent = { title: string; body: string };

/* -------------------------------------------------------------------------- */
/* Stable identifiers                                                         */
/* -------------------------------------------------------------------------- */

/** Deterministic id for a recurring reminder, keyed by the recurring row id. */
export function recurringNotificationId(recurringId: string): string {
  return `ledger-recurring-${recurringId}`;
}

/** Deterministic id for a budget-threshold notification within a month. */
export function budgetNotificationId(monthKey: string, threshold: number): string {
  return `ledger-budget-${monthKey}-${threshold}`;
}

/** Single stable id for the monthly summary (only ever one scheduled). */
export const SUMMARY_NOTIFICATION_ID = 'ledger-summary';

/* -------------------------------------------------------------------------- */
/* Recurring reminders                                                        */
/* -------------------------------------------------------------------------- */

/**
 * When to fire a reminder for a charge expected on `nextExpectedDateKey`
 * (`YYYY-MM-DD`), `leadDays` before, at `hour` local time. Day arithmetic goes
 * through the `Date` constructor so month/year rollovers are handled naturally.
 */
export function computeRecurringReminderDate(
  nextExpectedDateKey: string,
  leadDays: number,
  hour: number = REMINDER_HOUR
): Date {
  const [year, month, day] = nextExpectedDateKey.split('-').map(Number);
  return new Date(year, month - 1, day - leadDays, hour, 0, 0, 0);
}

/** "tomorrow" for a 1-day lead, otherwise "in N days". */
export function recurringLeadPhrase(leadDays: RecurringLeadDays): string {
  return leadDays === 1 ? 'tomorrow' : `in ${leadDays} days`;
}

/**
 * Reminder copy. Uses "expected" language — a detected pattern is a prediction,
 * never a certainty.
 *
 *   "Spotify expected tomorrow" / "$11.99"
 *   "Netflix expected in 3 days" / "$22.99"
 */
export function buildRecurringContent(input: {
  merchant: string;
  amount: number;
  currency: string;
  leadDays: RecurringLeadDays;
}): NotificationContent {
  return {
    title: `${input.merchant} expected ${recurringLeadPhrase(input.leadDays)}`,
    body: formatCurrency(input.amount, input.currency),
  };
}

/* -------------------------------------------------------------------------- */
/* Budget threshold engine                                                    */
/* -------------------------------------------------------------------------- */

/** Whole-percent of a budget used, via exact cents (0 when no limit). */
function percentUsed(spend: number, budgetLimit: number): number {
  const limitCents = amountToCents(budgetLimit);
  if (limitCents <= 0) return 0;
  return (amountToCents(spend) / limitCents) * 100;
}

/** Thresholds whose level `spend` has reached against `budgetLimit`. */
export function thresholdsSatisfied(spend: number, budgetLimit: number): number[] {
  const pct = percentUsed(spend, budgetLimit);
  return BUDGET_THRESHOLDS.filter((t) => pct >= t);
}

export type BudgetCrossingInput = {
  previousSpend: number;
  currentSpend: number;
  budgetLimit: number;
  /** Thresholds already notified for this month. */
  alreadyNotified: number[];
};

/**
 * The single budget threshold to notify about, or `null`.
 *
 * A threshold counts as *crossed* when current spend reaches it but previous
 * spend did not, and it hasn't already been notified this month. When one jump
 * crosses several levels (e.g. 73% → 105%), the highest is returned so the user
 * gets one meaningful alert, not three. Deterministic and side-effect free.
 */
export function getCrossedBudgetThreshold(input: BudgetCrossingInput): number | null {
  const { previousSpend, currentSpend, budgetLimit, alreadyNotified } = input;
  if (amountToCents(budgetLimit) <= 0) return null;

  const before = new Set(thresholdsSatisfied(previousSpend, budgetLimit));
  const notified = new Set(alreadyNotified);

  const crossed = thresholdsSatisfied(currentSpend, budgetLimit).filter(
    (t) => !before.has(t) && !notified.has(t)
  );

  return crossed.length > 0 ? Math.max(...crossed) : null;
}

/**
 * Budget copy. Below 100% shows remaining; at/over 100% switches to "reached"
 * and never shows a negative remaining.
 */
export function buildBudgetContent(input: {
  threshold: number;
  monthName: string;
  remaining: number;
  currency: string;
}): NotificationContent {
  const { threshold, monthName, remaining, currency } = input;
  const money = (amount: number) => formatCurrency(Math.max(0, amount), currency);

  if (threshold >= 100) {
    return {
      title: `You've reached your ${monthName} budget`,
      body: `${money(remaining)} remaining`,
    };
  }
  return {
    title: `You've used ${threshold}% of your ${monthName} budget`,
    body: `${money(remaining)} remaining`,
  };
}

/* -------------------------------------------------------------------------- */
/* Monthly summary                                                            */
/* -------------------------------------------------------------------------- */

/**
 * When to deliver the summary for the month `now` is in: the first day of the
 * *next* month at `hour` local time. The `Date` constructor rolls December over
 * to January of the following year automatically.
 */
export function computeMonthlySummaryDate(now: Date, hour: number = REMINDER_HOUR): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, hour, 0, 0, 0);
}

/** Summary copy: "September summary is ready" / "You spent $1,842.26 this month." */
export function buildSummaryContent(input: {
  monthName: string;
  spent: number;
  currency: string;
}): NotificationContent {
  return {
    title: `${input.monthName} summary is ready`,
    body: `You spent ${formatCurrency(input.spent, input.currency)} this month.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Deep-link routing                                                          */
/* -------------------------------------------------------------------------- */

const ROUTE_BY_KIND: Record<NotificationKind, NotificationRoute> = {
  recurring: '/recurring',
  budget: '/budget',
  summary: '/insights',
};

/** The deep-link route for a notification kind. */
export function routeForKind(kind: NotificationKind): NotificationRoute {
  return ROUTE_BY_KIND[kind];
}

/**
 * Extract the deep-link route from a tapped notification's data payload. Returns
 * `null` for anything that isn't a Ledger notification, so foreign notifications
 * never trigger navigation.
 */
export function routeForNotificationData(data: unknown): NotificationRoute | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as { ledger?: unknown; kind?: unknown; route?: unknown };
  if (value.ledger !== true) return null;

  if (
    value.route === '/recurring' ||
    value.route === '/budget' ||
    value.route === '/insights'
  ) {
    return value.route;
  }
  if (value.kind === 'recurring' || value.kind === 'budget' || value.kind === 'summary') {
    return ROUTE_BY_KIND[value.kind];
  }
  return null;
}
