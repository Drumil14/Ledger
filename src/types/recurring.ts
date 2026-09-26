/**
 * Recurring-expense domain types. Detection is deterministic (see
 * `src/features/recurring/detection.ts`); these types describe both the derived
 * candidates and the persisted user decisions.
 */

/** Supported recurrence frequencies. MVP focuses on `monthly`. */
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/** A user's decision about a detected pattern. `possible` is transient/derived. */
export type RecurringStatus = 'possible' | 'confirmed' | 'ignored';

/** How the record came to exist. */
export type RecurringSource = 'detected' | 'manual';

/**
 * Internal, deterministic confidence derived purely from evidence (occurrence
 * count + amount consistency). Never surfaced to users as a numeric "AI score".
 */
export type RecurringConfidence = 'low' | 'medium' | 'high';

/** A persisted recurring-expense decision (row in `recurring_expenses`). */
export type RecurringExpense = {
  id: string;
  merchant: string;
  normalizedMerchant: string;
  /** Representative amount, or null when never captured. */
  expectedAmount: number | null;
  frequency: RecurringFrequency;
  /** ISO `YYYY-MM-DD`, or null. */
  nextExpectedDate: string | null;
  status: RecurringStatus;
  source: RecurringSource;
  lastTransactionId?: string;
  /** ISO 8601 timestamp. */
  lastDetectedAt?: string;
};
