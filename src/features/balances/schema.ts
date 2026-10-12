import { z } from 'zod';

import { parseAmountToCents } from '@/lib/money';
import { toDateKey } from '@/features/forecast/dates';
import type { UpsertBalanceInput } from '@/services/balances';

/**
 * A balance is always explicitly entered. The amount field holds a positive
 * magnitude; `negative` flags an overdraft so the sign is deliberate, never
 * inferred.
 */
export const balanceFormSchema = z.object({
  amount: z
    .string()
    .refine((value) => parseAmountToCents(value) !== null, 'Enter an amount'),
  negative: z.boolean(),
  /** As-of date. Never in the future — a balance can't be known ahead of time. */
  date: z.date(),
});

export type BalanceFormValues = z.infer<typeof balanceFormSchema>;

export function emptyBalanceForm(now: Date): BalanceFormValues {
  return { amount: '', negative: false, date: now };
}

/** Map validated form values to the service upsert input (sign applied here). */
export function balanceFormToInput(values: BalanceFormValues): UpsertBalanceInput {
  const cents = parseAmountToCents(values.amount);
  if (cents === null) throw new Error('Invalid amount');
  return {
    amountCents: values.negative ? -cents : cents,
    currency: 'USD',
    effectiveDate: toDateKey(values.date),
  };
}
