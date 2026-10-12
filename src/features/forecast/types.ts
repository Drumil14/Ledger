/**
 * Cash-flow forecasting — domain types (implemented in Phase 2A).
 *
 * The engine is pure and deterministic: every function takes plain data plus an
 * injected `asOf` date and returns a typed result. No React, no Supabase, no
 * Expo, no `Date.now()` inside calculations, no randomness, no LLM. Identical
 * inputs always yield identical output — the same discipline as
 * `insights/analytics.ts` and `recurring/detection.ts`.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Invariants
 * ──────────────────────────────────────────────────────────────────────────
 *  • Integer cents everywhere (`Cents`). Convert at the boundary via `@/lib/money`.
 *  • Never ask an LLM to compute an amount; every figure is deterministic math.
 *  • Facts vs estimates are explicit per event: `basis: 'scheduled'` is a concrete
 *    commitment (a confirmed recurring expense occurrence, or a declared income
 *    deposit) whose amount and date are known/intended; `basis: 'estimated'` is a
 *    statistical projection (the discretionary run-rate). (This refines the Phase 1
 *    `'actual' | 'estimated'` wording — a forward-dated event has not actually
 *    happened, so "actual" was misleading; "scheduled" is the honest label.)
 *  • Never invent an account balance. Ledger stores none, so the forecast is a
 *    RELATIVE net-change by default. An absolute balance is produced ONLY when the
 *    caller supplies a real `startingBalanceCents`; otherwise balances stay null.
 *  • Income is never inferred. It is an explicit, optional input; when absent the
 *    forecast reports outflows only and warns `missing-income`.
 *  • Degrade, don't guess: thin history, irregular spend, missing income, unknown
 *    balance and stale recurrence surface as `ForecastWarning`s + lowered
 *    `ForecastConfidence`, never as false precision.
 */

import type { IncomeSchedule } from '@/types/income';
import type { RecurringExpense } from '@/types/recurring';
import type { Transaction } from '@/types/transaction';

export type { IncomeSchedule } from '@/types/income';

/** Integer cents. The engine never handles fractional money internally. */
export type Cents = number;

/* -------------------------------------------------------------------------- */
/* Income                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The forecast-relevant projection of an income source — what the engine needs
 * to place deposits, independent of how it's stored. Built from a persisted
 * `IncomeSource` by the assembly mapper.
 *
 * The `schedule` kinds behave as:
 *  • `weekly` / `biweekly` — every 7 / 14 days from `anchorDate` (income does not
 *    exist before its anchor, so no occurrences are generated earlier).
 *  • `monthly` — on `dayOfMonth` (1–31); the day-of-month intent is preserved and
 *    clamped per month (e.g. 31 → Feb 28/29), never drifting.
 *  • `one-time` — a single deposit on `date`.
 *  • `custom` — an explicit list of deposit `dates`.
 *
 * `startDate` / `endDate` clip the active window (inclusive): deposits before the
 * start or after the end are never projected, so an income that begins or ends
 * mid-horizon is handled correctly.
 */
export interface ForecastIncomeSource {
  id: string;
  label: string;
  /** Positive cents received on each occurrence of the schedule. */
  amountCents: Cents;
  schedule: IncomeSchedule;
  /** ISO `YYYY-MM-DD`; occurrences before this are suppressed. Optional. */
  startDate?: string;
  /** ISO `YYYY-MM-DD`; occurrences after this are suppressed. Optional. */
  endDate?: string;
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

/** The forecast window: an explicit day count, or "to the end of this month". */
export type ForecastHorizon = { kind: 'days'; days: number } | { kind: 'end-of-month' };

export interface ForecastInput {
  /** Full transaction history (expenses). Dates are ISO 8601, as elsewhere. */
  transactions: Transaction[];
  /**
   * Recurring patterns. Only `status: 'confirmed'` rows become scheduled future
   * outflows — `possible` / `ignored` (cancelled/inactive) are filtered out by the
   * engine. Detection is NOT re-run here; the engine consumes decisions.
   */
  recurring: RecurringExpense[];
  /** Declared income sources. Empty ⇒ outflow-only forecast (`missing-income`). */
  income: ForecastIncomeSource[];
  /** The "present" instant. Injected for determinism; never read from the clock. */
  asOf: Date;
  horizon: ForecastHorizon;
  /**
   * A REAL, user-declared balance with the date it was accurate as of. Omit when
   * unknown — the engine then yields a relative net-change forecast and never
   * fabricates one. A balance anchors an ABSOLUTE projection only when its
   * effective date IS `asOf` itself. An earlier (or future) snapshot is NOT rolled
   * forward: the app cannot confirm scheduled income was actually received, nor
   * that recorded spending is a complete record of account activity, so inventing
   * a "current" balance from it would be false precision. The forecast stays
   * relative and the snapshot's date is kept only as provenance.
   */
  balance?: ForecastDeclaredBalance;
  /** Override the run-rate look-back window (days). Defaults to 90. */
  runRateWindowDays?: number;
  currency?: string;
}

/** A user-declared balance plus the date it was accurate as of. */
export interface ForecastDeclaredBalance {
  amountCents: Cents;
  /** ISO `YYYY-MM-DD` the balance was accurate as of. */
  asOfDate: string;
}

/* -------------------------------------------------------------------------- */
/* Events & results                                                           */
/* -------------------------------------------------------------------------- */

export type ForecastDirection = 'income' | 'expense';

/** A concrete commitment (`scheduled`) vs a statistical projection (`estimated`). */
export type ForecastBasis = 'scheduled' | 'estimated';

/** Where a figure came from — all deterministic, never an LLM. */
export type ForecastSource =
  | 'confirmed-recurring' // a scheduled recurring expense occurrence
  | 'declared-income' // a projected income deposit
  | 'historical-average'; // the discretionary run-rate from past spend

/** A single expected future cash movement. */
export interface ForecastEvent {
  /** ISO `YYYY-MM-DD` the movement is expected on. */
  date: string;
  /** Signed cents: negative = outflow, positive = inflow. */
  amountCents: Cents;
  direction: ForecastDirection;
  basis: ForecastBasis;
  source: ForecastSource;
  /** Human-readable label for explainable UI copy (e.g. "Spotify"). */
  label: string;
}

/** One day on the projected cumulative net-change (and balance, if known) line. */
export interface ForecastPoint {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Cumulative signed net change since `asOf`, in cents. */
  netChangeCents: Cents;
  /** Absolute projected balance in cents, or null when no real balance was given. */
  projectedBalanceCents: Cents | null;
}

/** Why a forecast is less than fully reliable — surfaced instead of guessing. */
export type ForecastWarning =
  | 'missing-income' // no declared income — outflows only
  | 'insufficient-history' // too few days/transactions for a stable run-rate
  | 'irregular-spending' // high week-to-week variance; run-rate is a weak estimate
  | 'stale-recurrence' // a confirmed pattern is missing data or overdue
  | 'stale-balance' // declared balance isn't current; not rolled forward — relative only
  | 'no-starting-balance'; // balance unknown — result is relative only

/** Coarse confidence derived from data sufficiency (never a model score). */
export type ForecastConfidence = 'high' | 'medium' | 'low';

/**
 * Provenance of the balance a projection is anchored to. There is exactly one
 * trustworthy basis, because Ledger has no bank feed to reconcile against:
 *  • `declared` — a balance the user entered FOR `asOf` itself (today). Used as
 *                 the absolute baseline as-is. Deliberately "declared", never
 *                 "verified": it is a self-reported figure, NOT confirmed against
 *                 a bank. An earlier snapshot is never rolled forward into a
 *                 present balance — the app cannot confirm scheduled income was
 *                 received or that recorded spending is complete — so a non-current
 *                 snapshot yields a RELATIVE forecast (`balanceBasis` null), never
 *                 a fabricated "current" balance.
 */
export type BalanceBasis = 'declared';

export interface ForecastResult {
  /** `asOf` as an ISO `YYYY-MM-DD` key. */
  asOf: string;
  /** First forecast day (the day after `asOf`). */
  horizonStart: string;
  /** Last forecast day (inclusive). */
  horizonEnd: string;
  currency: string;
  /** Scheduled + estimated movements within the window, chronological & deduped. */
  events: ForecastEvent[];
  /** One point per day in the window; continuous line for charting. */
  series: ForecastPoint[];
  /** Net change over the whole window (sum of event amounts), in cents. */
  netChangeCents: Cents;
  /**
   * Balance at `asOf` used as the projection baseline (verified or calculated),
   * or null when none could be defensibly established (relative forecast).
   */
  currentBalanceCents: Cents | null;
  /** How `currentBalanceCents` was derived, or null when relative. */
  balanceBasis: BalanceBasis | null;
  /** Effective date of the declared balance (provenance), or null when none. */
  balanceAsOfDate: string | null;
  /** Projected end-of-window balance, or null when no usable balance was supplied. */
  projectedBalanceCents: Cents | null;
  /** The discretionary daily run-rate used for `historical-average` events. */
  dailyRunRateCents: Cents;
  confidence: ForecastConfidence;
  warnings: ForecastWarning[];
}

/* -------------------------------------------------------------------------- */
/* Engine signature                                                           */
/* -------------------------------------------------------------------------- */

/** The top-level engine entry point. Pure: `(input) => result`. */
export type BuildForecast = (input: ForecastInput) => ForecastResult;
