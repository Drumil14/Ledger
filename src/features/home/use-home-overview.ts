import { useMemo } from 'react';

import { currentMonthKey } from '@/lib/month';
import { useBudgetQuery } from '@/features/budgets/queries';
import { useTransactionsQuery } from '@/features/transactions/queries';

import { computeHomeOverview, type HomeOverview } from './overview';

type Result = {
  isLoading: boolean;
  isError: boolean;
  data: HomeOverview | undefined;
  refetch: () => void;
};

/**
 * Composes the transactions + current-month budget queries into the Home
 * overview. All derivation lives in `computeHomeOverview`, so the screen just
 * renders. The budget is month-specific and may be null (no budget set).
 */
export function useHomeOverview(): Result {
  const transactions = useTransactionsQuery();
  const budget = useBudgetQuery(currentMonthKey());

  const data = useMemo(() => {
    if (!transactions.data) return undefined;
    return computeHomeOverview(transactions.data, budget.data ?? null, new Date());
  }, [transactions.data, budget.data]);

  return {
    isLoading: transactions.isLoading || budget.isLoading,
    isError: transactions.isError || budget.isError,
    data,
    refetch: () => {
      void transactions.refetch();
      void budget.refetch();
    },
  };
}
