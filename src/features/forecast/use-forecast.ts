/**
 * `useForecast` — composes the transaction, recurring, income and balance queries
 * and runs the pure `buildForecast` engine over them.
 *
 * It follows the same shape as `useInsights`: inject a fixed `now` (`asOf`) for
 * determinism, derive everything in a `useMemo` from the already-cached query
 * data, and expose `{ isLoading, isError, data, refetch }`. Because it reuses the
 * underlying feature queries, any mutation that invalidates transactions,
 * recurring, income or balances automatically refreshes the forecast — no
 * separate forecast query key to invalidate.
 *
 * All heavy lifting stays in the pure engine (`assembleForecastInput` +
 * `buildForecast`); this hook adds no financial logic of its own.
 */

import { useMemo } from 'react';

import { useBalancesQuery } from '@/features/balances/queries';
import { useIncomeQuery } from '@/features/income/queries';
import { useRecurringQuery } from '@/features/recurring/queries';
import { useTransactionsQuery } from '@/features/transactions/queries';

import { assembleForecastInput } from './assemble';
import { buildForecast } from './forecast';
import type { ForecastHorizon, ForecastResult } from './types';

export type UseForecastOptions = {
  asOf: Date;
  horizon: ForecastHorizon;
  /** Optional override of the run-rate look-back window (days). */
  runRateWindowDays?: number;
};

export type ForecastQueryResult = {
  isLoading: boolean;
  isError: boolean;
  /** True when there is genuinely nothing to forecast from (no inputs at all). */
  isEmpty: boolean;
  /** True when inputs span more than one currency and were refused, not combined. */
  currencyMismatch: boolean;
  /** The distinct currencies seen when `currencyMismatch` is true. */
  mismatchCurrencies: string[];
  data: ForecastResult | undefined;
  refetch: () => void;
};

export function useForecast(options: UseForecastOptions): ForecastQueryResult {
  const { asOf, horizon, runRateWindowDays } = options;

  const transactions = useTransactionsQuery();
  const recurring = useRecurringQuery();
  const income = useIncomeQuery();
  const balances = useBalancesQuery();

  const assembled = useMemo(() => {
    if (!transactions.data || !recurring.data || !income.data || !balances.data) return undefined;
    return assembleForecastInput({
      transactions: transactions.data,
      recurring: recurring.data,
      income: income.data,
      balances: balances.data,
      asOf,
      horizon,
      runRateWindowDays,
    });
  }, [transactions.data, recurring.data, income.data, balances.data, asOf, horizon, runRateWindowDays]);

  const data = useMemo<ForecastResult | undefined>(() => {
    if (!assembled || !assembled.ok) return undefined;
    return buildForecast(assembled.input);
  }, [assembled]);

  const currencyMismatch = assembled?.ok === false;

  return {
    isLoading:
      transactions.isLoading || recurring.isLoading || income.isLoading || balances.isLoading,
    isError:
      transactions.isError || recurring.isError || income.isError || balances.isError || currencyMismatch,
    isEmpty: assembled?.ok === true ? assembled.isEmpty : false,
    currencyMismatch,
    mismatchCurrencies: assembled && !assembled.ok ? assembled.currencies : [],
    data,
    refetch: () => {
      void transactions.refetch();
      void recurring.refetch();
      void income.refetch();
      void balances.refetch();
    },
  };
}
