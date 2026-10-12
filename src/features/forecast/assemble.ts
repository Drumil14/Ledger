/**
 * Forecast input assembly — the pure bridge between persisted records and the
 * forecasting engine.
 *
 * Kept deliberately separate from React/TanStack Query so the composition logic
 * (pick the relevant balance, map income records to engine inputs, refuse to mix
 * currencies) is deterministic and unit-testable on its own. The `useForecast`
 * hook is a thin wrapper that feeds query data in and runs `buildForecast` on the
 * result. No Supabase, no clock, no React here.
 */

import type { BalanceSnapshot, IncomeSource } from '@/types/income';
import type { RecurringExpense } from '@/types/recurring';
import type { Transaction } from '@/types/transaction';

import { compareKeys, dateKeyFromISO, toDateKey } from './dates';
import type { ForecastHorizon, ForecastIncomeSource, ForecastInput } from './types';

export type AssembleArgs = {
  transactions: Transaction[];
  recurring: RecurringExpense[];
  income: IncomeSource[];
  balances: BalanceSnapshot[];
  asOf: Date;
  horizon: ForecastHorizon;
  runRateWindowDays?: number;
};

export type AssembleResult =
  | {
      ok: true;
      input: ForecastInput;
      isEmpty: boolean;
      /** Effective date of the balance used, or null when none was available. */
      balanceEffectiveDate: string | null;
    }
  | { ok: false; reason: 'currency-mismatch'; currencies: string[] };

/** Project a persisted income record onto the leaner engine input shape. */
function toForecastIncome(record: IncomeSource): ForecastIncomeSource {
  return {
    id: record.id,
    label: record.name,
    amountCents: record.amountCents,
    schedule: record.schedule,
    startDate: record.startDate,
    endDate: record.endDate ?? undefined,
  };
}

/** The latest balance snapshot effective on or before `asOf`, or null. */
function pickBalance(balances: BalanceSnapshot[], asOfKey: string): BalanceSnapshot | null {
  let chosen: BalanceSnapshot | null = null;
  for (const b of balances) {
    if (compareKeys(dateKeyFromISO(b.effectiveDate), asOfKey) > 0) continue; // future snapshot
    if (!chosen || compareKeys(dateKeyFromISO(b.effectiveDate), dateKeyFromISO(chosen.effectiveDate)) > 0) {
      chosen = b;
    }
  }
  return chosen;
}

/**
 * Build a `ForecastInput` from persisted records, or report a currency mismatch.
 *
 * Only `active` income is forecast. The starting balance is the newest snapshot
 * on or before `asOf` (future snapshots are ignored). If the inputs that would be
 * combined span more than one currency we refuse — the engine works in cents and
 * must never silently add, say, EUR income to a USD balance.
 */
export function assembleForecastInput(args: AssembleArgs): AssembleResult {
  const asOfKey = toDateKey(args.asOf);
  const activeIncome = args.income.filter((i) => i.active);
  const balance = pickBalance(args.balances, asOfKey);
  const confirmedRecurring = args.recurring.filter((r) => r.status === 'confirmed');

  // Currencies that would actually be combined into one projection. (Recurring
  // expenses carry no currency — they are implicitly the app's base currency.)
  const currencies = new Set<string>();
  for (const t of args.transactions) currencies.add(t.currency);
  for (const i of activeIncome) currencies.add(i.currency);
  if (balance) currencies.add(balance.currency);

  if (currencies.size > 1) {
    return { ok: false, reason: 'currency-mismatch', currencies: [...currencies].sort() };
  }

  const currency =
    balance?.currency ?? activeIncome[0]?.currency ?? args.transactions[0]?.currency ?? 'USD';

  const input: ForecastInput = {
    transactions: args.transactions,
    recurring: args.recurring,
    income: activeIncome.map(toForecastIncome),
    asOf: args.asOf,
    horizon: args.horizon,
    // Pass the balance WITH its effective date so the engine can roll a stale
    // snapshot forward (or decline to), never treating it as today's balance.
    balance: balance ? { amountCents: balance.amountCents, asOfDate: balance.effectiveDate } : undefined,
    runRateWindowDays: args.runRateWindowDays,
    currency,
  };

  const isEmpty =
    args.transactions.length === 0 &&
    activeIncome.length === 0 &&
    confirmedRecurring.length === 0 &&
    balance === null;

  return { ok: true, input, isEmpty, balanceEffectiveDate: balance ? balance.effectiveDate : null };
}
