import { z } from 'zod';

import { CATEGORIES, isCategory } from '@/constants/categories';
import { amountToInput, centsToAmount, parseAmountToCents } from '@/lib/money';
import type { CreateTransactionInput, UpdateTransactionInput } from '@/services/transactions';
import type { Transaction } from '@/types/transaction';

export const transactionFormSchema = z.object({
  amount: z
    .string()
    .refine((value) => parseAmountToCents(value) !== null, 'Enter an amount greater than 0'),
  merchant: z.string().trim().min(1, 'Merchant is required').max(120, 'Keep it under 120 characters'),
  category: z.enum(CATEGORIES),
  date: z.date(),
  note: z.string().trim().max(200, 'Keep notes under 200 characters').optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const emptyTransactionForm = (): TransactionFormValues => ({
  amount: '',
  merchant: '',
  category: 'Groceries',
  date: new Date(),
  note: '',
});

/** Prefill the shared form when editing an existing transaction. */
export function transactionToFormValues(transaction: Transaction): TransactionFormValues {
  return {
    amount: amountToInput(transaction.amount),
    merchant: transaction.merchant,
    category: isCategory(transaction.category) ? transaction.category : 'Other',
    date: new Date(transaction.date),
    note: transaction.note ?? '',
  };
}

function normalizedAmount(values: TransactionFormValues): number {
  const cents = parseAmountToCents(values.amount);
  if (cents === null) throw new Error('Invalid amount');
  return centsToAmount(cents);
}

export function formValuesToCreateInput(values: TransactionFormValues): CreateTransactionInput {
  const note = values.note?.trim();
  return {
    amount: normalizedAmount(values),
    merchant: values.merchant.trim(),
    category: values.category,
    date: values.date.toISOString(),
    note: note ? note : undefined,
    sourceType: 'manual',
  };
}

export function formValuesToUpdateInput(
  id: string,
  values: TransactionFormValues
): UpdateTransactionInput {
  const note = values.note?.trim();
  return {
    id,
    amount: normalizedAmount(values),
    merchant: values.merchant.trim(),
    category: values.category,
    date: values.date.toISOString(),
    note: note ? note : undefined,
  };
}
