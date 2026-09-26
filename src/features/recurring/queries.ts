import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpsertRecurringInput } from '@/services/recurring';
import { recurringRepo } from '@/features/demo/repositories';

export const recurringKeys = {
  all: ['recurring'] as const,
  list: () => [...recurringKeys.all, 'list'] as const,
};

/** All of the user's recurring-expense decisions (confirmed / ignored). */
export function useRecurringQuery() {
  return useQuery({
    queryKey: recurringKeys.list(),
    queryFn: () => recurringRepo.fetch(),
  });
}

export function useConfirmRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertRecurringInput) => recurringRepo.confirm(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
    },
  });
}

export function useIgnoreRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertRecurringInput) => recurringRepo.ignore(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringRepo.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
    },
  });
}
