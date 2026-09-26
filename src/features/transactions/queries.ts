import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Transaction } from '@/types/transaction';
import type { CreateTransactionInput, UpdateTransactionInput } from '@/services/transactions';
import { transactionsRepo } from '@/features/demo/repositories';

export type TransactionFilters = {
  search?: string;
  category?: string;
};

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
};

/** All of the user's transactions (filtering/search happens client-side for now). */
export function useTransactionsQuery() {
  return useQuery({
    queryKey: transactionKeys.lists(),
    queryFn: () => transactionsRepo.fetch(),
  });
}

/** Read a single transaction from the already-cached list (no extra request). */
export function useCachedTransaction(id: string | undefined): Transaction | undefined {
  const { data } = useTransactionsQuery();
  if (!id) return undefined;
  return data?.find((t) => t.id === id);
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => transactionsRepo.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => transactionsRepo.update(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const listKey = transactionKeys.lists();

  return useMutation({
    mutationFn: (id: string) => transactionsRepo.remove(id),
    // Optimistically remove the row; roll back if the request fails.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Transaction[]>(listKey);
      if (previous) {
        queryClient.setQueryData<Transaction[]>(
          listKey,
          previous.filter((t) => t.id !== id)
        );
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
