import { amountToCents, centsToAmount, sumAmounts } from '@/lib/money';
import { monthKeyFromDate } from '@/lib/month';
import type { Transaction } from '@/types/transaction';

export type BudgetStatus = {
  hasBudget: boolean;
  limit: number | null;
  /** limit − spent (negative when over budget). */
  remaining: number | null;
  /** Uncapped whole-percent used, e.g. 106. Null when there is no budget. */
  percentUsed: number | null;
  overBudget: boolean;
  /** spent − limit when over, else null. */
  overAmount: number | null;
  /** 0–1 for the progress bar (capped at full width). */
  progress: number;
};

/** Total spending for a given month key (`YYYY-MM`), using exact cents math. */
export function sumSpendingForMonth(transactions: Transaction[], monthKey: string): number {
  const amounts = transactions
    .filter((t) => monthKeyFromDate(new Date(t.date)) === monthKey)
    .map((t) => t.amount);
  return sumAmounts(amounts);
}

/**
 * Budget math shared by Home and the budget screen. `limit === null` means the
 * user has no budget for the month (distinct from a budget of 0, which the
 * schema forbids anyway).
 */
export function computeBudgetStatus(limit: number | null, spent: number): BudgetStatus {
  if (limit === null) {
    return {
      hasBudget: false,
      limit: null,
      remaining: null,
      percentUsed: null,
      overBudget: false,
      overAmount: null,
      progress: 0,
    };
  }

  const spentCents = amountToCents(spent);
  const limitCents = amountToCents(limit);
  const overBudget = spentCents > limitCents;

  return {
    hasBudget: true,
    limit,
    remaining: centsToAmount(limitCents - spentCents),
    percentUsed: limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : null,
    overBudget,
    overAmount: overBudget ? centsToAmount(spentCents - limitCents) : null,
    progress: limitCents > 0 ? Math.min(spentCents / limitCents, 1) : 0,
  };
}
