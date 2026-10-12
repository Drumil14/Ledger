import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateIncomeInput, UpdateIncomeInput } from '@/services/income';
import { incomeRepo } from '@/features/demo/repositories';

export const incomeKeys = {
  all: ['income'] as const,
  list: () => [...incomeKeys.all, 'list'] as const,
};

/** All of the user's declared income sources. */
export function useIncomeQuery() {
  return useQuery({
    queryKey: incomeKeys.list(),
    queryFn: () => incomeRepo.fetch(),
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIncomeInput) => incomeRepo.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIncomeInput) => incomeRepo.update(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => incomeRepo.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}
