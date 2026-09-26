import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpsertBudgetInput } from '@/services/budgets';
import { budgetsRepo } from '@/features/demo/repositories';

export const budgetKeys = {
  all: ['budgets'] as const,
  month: (monthKey: string) => [...budgetKeys.all, 'month', monthKey] as const,
  history: () => [...budgetKeys.all, 'history'] as const,
};

/** Budget for a single month (`YYYY-MM`). `data` is `null` when none exists. */
export function useBudgetQuery(monthKey: string) {
  return useQuery({
    queryKey: budgetKeys.month(monthKey),
    queryFn: () => budgetsRepo.fetchOne(monthKey),
  });
}

export function useBudgetHistoryQuery() {
  return useQuery({
    queryKey: budgetKeys.history(),
    queryFn: () => budgetsRepo.fetchAll(),
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertBudgetInput) => budgetsRepo.upsert(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (monthKey: string) => budgetsRepo.remove(monthKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
