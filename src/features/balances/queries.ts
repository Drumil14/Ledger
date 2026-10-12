import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpsertBalanceInput } from '@/services/balances';
import { balancesRepo } from '@/features/demo/repositories';

export const balanceKeys = {
  all: ['balances'] as const,
  list: () => [...balanceKeys.all, 'list'] as const,
};

/** All of the user's declared balance snapshots, newest first. */
export function useBalancesQuery() {
  return useQuery({
    queryKey: balanceKeys.list(),
    queryFn: () => balancesRepo.fetch(),
  });
}

export function useUpsertBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertBalanceInput) => balancesRepo.upsert(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: balanceKeys.all });
    },
  });
}

export function useDeleteBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => balancesRepo.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: balanceKeys.all });
    },
  });
}
