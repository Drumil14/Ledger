import { useMemo } from 'react';

import { monthLabel } from '@/lib/month';
import { computeBudgetStatus, type BudgetStatus } from '@/features/budgets/summary';
import { useBudgetQuery } from '@/features/budgets/queries';
import { useTransactionsQuery } from '@/features/transactions/queries';
import type { Transaction } from '@/types/transaction';

import {
  computeCategoryComparison,
  computeCategoryTotals,
  computeCumulativeSeries,
  computeMonthComparison,
  computeMonthlySpend,
  computeProjection,
  computeSpendingPace,
  computeWeekendSpending,
  generateDeterministicInsights,
  getLargestTransactions,
  getTransactionsForMonth,
  type CategoryComparison,
  type CategoryTotal,
  type CumulativeSeries,
  type Insight,
  type MonthComparison,
  type Projection,
  type SpendingPace,
  type WeekendSpending,
} from './analytics';

export type InsightsData = {
  monthKey: string;
  /** "September 2026". */
  monthLabel: string;
  /** "September". */
  monthName: string;
  currency: string;
  isCurrentMonth: boolean;
  isEmptyOverall: boolean;
  hasMonthData: boolean;
  hasPreviousData: boolean;
  spent: number;
  comparison: MonthComparison;
  categoryTotals: CategoryTotal[];
  categoryComparison: CategoryComparison[];
  pace: SpendingPace;
  projection: Projection;
  budget: BudgetStatus;
  largest: Transaction[];
  weekend: WeekendSpending;
  cumulative: CumulativeSeries;
  insights: Insight[];
};

type Result = {
  isLoading: boolean;
  isError: boolean;
  data: InsightsData | undefined;
  refetch: () => void;
};

/**
 * Composes the (all-transactions) list query with the selected month's budget,
 * then derives every insight from those via the pure `analytics` module. Month
 * switching just changes `monthKey` and re-derives — no extra server round-trips
 * for transactions; only the month-specific budget is fetched per month.
 */
export function useInsights(monthKey: string, now: Date): Result {
  const transactions = useTransactionsQuery();
  const budgetQuery = useBudgetQuery(monthKey);

  const data = useMemo<InsightsData | undefined>(() => {
    if (!transactions.data) return undefined;

    const all = transactions.data;
    const monthName = monthLabel(monthKey).split(' ')[0];
    const monthTx = getTransactionsForMonth(all, monthKey);
    const spent = computeMonthlySpend(all, monthKey);

    const budgetStatus = computeBudgetStatus(budgetQuery.data ? budgetQuery.data.limit : null, spent);
    const currency = budgetQuery.data?.currency ?? monthTx[0]?.currency ?? all[0]?.currency ?? 'USD';

    const comparison = computeMonthComparison(all, monthKey);
    const categoryTotals = computeCategoryTotals(all, monthKey);
    const categoryComparison = computeCategoryComparison(all, monthKey);
    const pace = computeSpendingPace(all, monthKey, now);
    const projection = computeProjection(all, monthKey, now);
    const largest = getLargestTransactions(all, monthKey, 5);
    const weekend = computeWeekendSpending(all, monthKey);
    const cumulative = computeCumulativeSeries(all, monthKey, now);

    const insights = generateDeterministicInsights({
      monthKey,
      now,
      currency,
      monthName,
      comparison,
      pace,
      categoryTotals,
      categoryComparison,
      largest,
      weekend,
      budget: budgetStatus,
      monthSpend: spent,
      transactionCount: monthTx.length,
    });

    return {
      monthKey,
      monthLabel: monthLabel(monthKey),
      monthName,
      currency,
      isCurrentMonth: pace.isPartial,
      isEmptyOverall: all.length === 0,
      hasMonthData: monthTx.length > 0,
      hasPreviousData: comparison.previousHadSpending,
      spent,
      comparison,
      categoryTotals,
      categoryComparison,
      pace,
      projection,
      budget: budgetStatus,
      largest,
      weekend,
      cumulative,
      insights,
    };
  }, [transactions.data, budgetQuery.data, monthKey, now]);

  return {
    isLoading: transactions.isLoading || budgetQuery.isLoading,
    isError: transactions.isError || budgetQuery.isError,
    data,
    refetch: () => {
      void transactions.refetch();
      void budgetQuery.refetch();
    },
  };
}
