import { z } from 'zod';

import { centsToAmount, parseAmountToCents } from '@/lib/money';

export const budgetFormSchema = z.object({
  amount: z
    .string()
    .refine((value) => parseAmountToCents(value) !== null, 'Enter a budget greater than 0'),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

/** Normalize a validated budget form to a dollar amount (via the cents helpers). */
export function budgetFormToLimit(values: BudgetFormValues): number {
  const cents = parseAmountToCents(values.amount);
  if (cents === null) throw new Error('Invalid budget');
  return centsToAmount(cents);
}
