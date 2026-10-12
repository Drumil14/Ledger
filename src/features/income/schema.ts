import { z } from 'zod';

import { amountToInput, centsToAmount, parseAmountToCents } from '@/lib/money';
import { toDateKey } from '@/features/forecast/dates';
import type { CreateIncomeInput, UpdateIncomeInput } from '@/services/income';
import type { IncomeSource } from '@/types/income';

/**
 * The entry form supports the four common cadences. `custom` (an arbitrary date
 * list) is supported by persistence + the engine but intentionally not exposed in
 * this form yet — a custom record edited here falls back to a one-time entry.
 */
export const INCOME_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'one-time'] as const;
export type IncomeFormFrequency = (typeof INCOME_FREQUENCIES)[number];

export const incomeFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Keep it under 120 characters'),
  amount: z
    .string()
    .refine((value) => parseAmountToCents(value) !== null, 'Enter an amount greater than 0'),
  frequency: z.enum(INCOME_FREQUENCIES),
  /** Anchor / first payment (also the day-of-month source for monthly). */
  date: z.date(),
  active: z.boolean(),
});

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

export function emptyIncomeForm(now: Date): IncomeFormValues {
  return { name: '', amount: '', frequency: 'monthly', date: now, active: true };
}

const FREQUENCY_LABELS: Record<IncomeFormFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  'one-time': 'One-time',
};

export function incomeFrequencyLabel(frequency: IncomeFormFrequency): string {
  return FREQUENCY_LABELS[frequency];
}

/** How the date field should be labelled for the chosen cadence. */
export function incomeDateLabel(frequency: IncomeFormFrequency): string {
  if (frequency === 'monthly') return 'Monthly on (day of month)';
  if (frequency === 'one-time') return 'Payment date';
  return 'Starts on';
}

/** Prefill the form from a persisted record (custom → one-time fallback). */
export function incomeToFormValues(record: IncomeSource): IncomeFormValues {
  const kind = record.schedule.kind;
  const frequency: IncomeFormFrequency =
    kind === 'weekly' || kind === 'biweekly' || kind === 'monthly' ? kind : 'one-time';

  const [y, m, d] = record.startDate.split('-').map(Number);
  return {
    name: record.name,
    amount: amountToInput(centsToAmount(record.amountCents)),
    frequency,
    date: new Date(y, m - 1, d),
    active: record.active,
  };
}

/** Map validated form values to the service create input. */
export function incomeFormToCreateInput(values: IncomeFormValues): CreateIncomeInput {
  const cents = parseAmountToCents(values.amount);
  if (cents === null) throw new Error('Invalid amount');

  const base: CreateIncomeInput = {
    name: values.name.trim(),
    amountCents: cents,
    currency: 'USD',
    frequency: values.frequency,
    startDate: toDateKey(values.date),
    active: values.active,
  };

  if (values.frequency === 'monthly') {
    return { ...base, dayOfMonth: values.date.getDate() };
  }
  return base;
}

/**
 * True when a record's schedule can be fully edited by this form. Custom
 * (arbitrary-date) schedules can't be represented here, so the form keeps them
 * read-only rather than silently collapsing them to a one-time entry.
 */
export function isEditableSchedule(record: IncomeSource): boolean {
  return record.schedule.kind !== 'custom';
}

/** Short human description of a schedule the form can't edit (e.g. custom). */
export function describeFixedSchedule(record: IncomeSource): string {
  if (record.schedule.kind === 'custom') {
    const count = record.schedule.dates.length;
    return `Custom · ${count} payment date${count === 1 ? '' : 's'}`;
  }
  return record.schedule.kind;
}

/**
 * Map validated form values to a service update input.
 *
 * - Custom schedules are PRESERVED: only name, amount and active status are sent,
 *   so the stored dates can never be silently overwritten by an edit.
 * - For editable schedules, cadence fields not used by the chosen frequency are
 *   explicitly cleared (set to null) so a stale `day_of_month` / `custom_dates`
 *   from a previous frequency can't linger in the row.
 */
export function incomeFormToUpdateInput(
  values: IncomeFormValues,
  existing: IncomeSource
): UpdateIncomeInput {
  if (!isEditableSchedule(existing)) {
    const cents = parseAmountToCents(values.amount);
    if (cents === null) throw new Error('Invalid amount');
    return {
      id: existing.id,
      name: values.name.trim(),
      amountCents: cents,
      currency: existing.currency,
      active: values.active,
    };
  }

  const base = incomeFormToCreateInput(values);
  return {
    id: existing.id,
    ...base,
    dayOfMonth: values.frequency === 'monthly' ? values.date.getDate() : null,
    customDates: null,
  };
}
