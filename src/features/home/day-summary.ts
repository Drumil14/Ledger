/**
 * Pure day-level derivation for the interactive spending chart.
 *
 * Reuses Ledger's established date convention (`startOfDay` from the Home
 * overview) so a transaction is bucketed by its **local** calendar day — a charge
 * at 2026-09-23T23:30 local stays under Sep 23, never bleeding into Sep 24 via UTC
 * parsing. Totals go through the integer-cents `sumAmounts` helper (no floating
 * point summing), and ordering is newest-first to match the rest of the app
 * (Home "Today", the Transactions list).
 */

import { sumAmounts } from '@/lib/money';
import type { Transaction } from '@/types/transaction';

import { startOfDay } from './overview';

export type DaySummary = {
  /** The selected calendar day. */
  date: Date;
  /** Exact-cents total for the day. */
  total: number;
  count: number;
  /** The day's transactions, newest first. */
  transactions: Transaction[];
};

/** Transactions on the same local calendar day as `date`, newest first. */
export function getTransactionsForDay(transactions: Transaction[], date: Date): Transaction[] {
  const target = startOfDay(date);
  return transactions
    .filter((t) => startOfDay(new Date(t.date)) === target)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Full summary (date, total, count, transactions) for a selected day. */
export function getDaySummary(transactions: Transaction[], date: Date): DaySummary {
  const dayTransactions = getTransactionsForDay(transactions, date);
  return {
    date,
    total: sumAmounts(dayTransactions.map((t) => t.amount)),
    count: dayTransactions.length,
    transactions: dayTransactions,
  };
}
