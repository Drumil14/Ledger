/**
 * Income & balance domain types.
 *
 * These are the persisted records (what Supabase stores and the demo store
 * mirrors). The forecasting engine consumes a leaner projection of an income
 * source (`ForecastIncomeSource` in `@/features/forecast`); a pure mapper bridges
 * the two, so the engine never depends on persistence concerns.
 *
 * Money is integer cents. A declared balance is ALWAYS user-provided — spending
 * history is never treated as a verified bank balance.
 */

/** How an income source recurs. `one-time` and `custom` are not plain frequencies. */
export type IncomeFrequency = 'weekly' | 'biweekly' | 'monthly' | 'one-time' | 'custom';

/**
 * The cadence detail the forecast engine needs. A discriminated union so each
 * kind carries exactly its own data (weekly/biweekly anchor, monthly day-of-month,
 * one-time date, custom explicit dates).
 */
export type IncomeSchedule =
  | { kind: 'weekly'; anchorDate: string }
  | { kind: 'biweekly'; anchorDate: string }
  | { kind: 'monthly'; dayOfMonth: number }
  | { kind: 'one-time'; date: string }
  | { kind: 'custom'; dates: string[] };

/** A persisted income source (row in `income_sources`). */
export type IncomeSource = {
  id: string;
  name: string;
  /** Positive cents received on each occurrence. */
  amountCents: number;
  currency: string;
  schedule: IncomeSchedule;
  /** ISO `YYYY-MM-DD` the source starts / anchors on. */
  startDate: string;
  /** ISO `YYYY-MM-DD` the source stops after, or null for open-ended. */
  endDate: string | null;
  active: boolean;
};

/**
 * A user-declared account balance at a point in time (row in `balance_snapshots`).
 * May be negative (overdraft/debt). Always explicitly entered by the user.
 */
export type BalanceSnapshot = {
  id: string;
  amountCents: number;
  currency: string;
  /** ISO `YYYY-MM-DD` the balance was accurate as of. */
  effectiveDate: string;
};
