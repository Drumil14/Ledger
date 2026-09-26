import { sumAmounts } from '@/lib/money';
import { computeBudgetStatus, type BudgetStatus } from '@/features/budgets/summary';
import type { Budget, Transaction } from '@/types/transaction';

export type ChartPoint = {
  /** Local start-of-day timestamp (ms) as a string — stable per calendar day. */
  key: string;
  label: string;
  value: number;
  /** Number of transactions on that day (for accessibility copy). */
  count: number;
};

export type HomeOverview = {
  monthLabel: string;
  currency: string;
  spent: number;
  chart: ChartPoint[];
  today: Transaction[];
  isEmpty: boolean;
} & BudgetStatus;

// Hoisted formatters (expensive to construct).
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long' });
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' });

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_DAYS = 7;

/** Local midnight (ms) for a date — the canonical per-day bucket key across Home. */
export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function computeHomeOverview(
  transactions: Transaction[],
  budget: Budget | null,
  now: Date
): HomeOverview {
  const spent = sumAmounts(
    transactions.filter((t) => sameMonth(new Date(t.date), now)).map((t) => t.amount)
  );
  const status = computeBudgetStatus(budget ? budget.limit : null, spent);

  const todayStart = startOfDay(now);
  const today = transactions
    .filter((t) => startOfDay(new Date(t.date)) === todayStart)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Daily totals for the trailing 7 days ending "now".
  const chart: ChartPoint[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(todayStart - i * DAY_MS);
    const dayStart = startOfDay(day);
    const dayTx = transactions.filter((t) => startOfDay(new Date(t.date)) === dayStart);
    const value = sumAmounts(dayTx.map((t) => t.amount));
    chart.push({
      key: String(dayStart),
      label: weekdayFormatter.format(day),
      value,
      count: dayTx.length,
    });
  }

  return {
    monthLabel: monthFormatter.format(now),
    currency: budget?.currency ?? 'USD',
    spent,
    chart,
    today,
    isEmpty: transactions.length === 0,
    ...status,
  };
}
