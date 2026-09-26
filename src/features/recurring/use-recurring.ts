import { useMemo } from 'react';

import { useTransactionsQuery } from '@/features/transactions/queries';
import type { RecurringExpense } from '@/types/recurring';
import type { Transaction } from '@/types/transaction';

import {
  detectRecurring,
  matchingTransactions,
  type RecurringCandidate,
} from './detection';
import { useRecurringQuery } from './queries';
import {
  computeAnnualEstimate,
  computeMonthlyRecurringTotal,
  generateRecurringInsights,
  type RecurringInsight,
} from './summary';

/** A confirmed recurring expense enriched with its live matching history. */
export type ConfirmedRecurring = {
  record: RecurringExpense;
  /** Live matches from transaction history, newest first. */
  transactions: Transaction[];
  /** Next charge estimate — live when a matching pattern still exists, else stored. */
  nextExpectedDate: string | null;
};

export type RecurringData = {
  currency: string;
  /** Confirmed subscriptions, largest monthly-equivalent first. */
  confirmed: ConfirmedRecurring[];
  /** Fresh candidates the user hasn't decided on yet. */
  candidates: RecurringCandidate[];
  monthlyTotal: number;
  annualEstimate: number;
  insights: RecurringInsight[];
  isEmpty: boolean;
};

type Result = {
  isLoading: boolean;
  isError: boolean;
  data: RecurringData | undefined;
  refetch: () => void;
};

/**
 * Composes the all-transactions query with the persisted recurring decisions,
 * runs the deterministic detection engine, and merges the two:
 *
 *   • Confirmed rows are enriched with their live matching transactions + a fresh
 *     next-charge estimate (falling back to the stored value if the pattern has
 *     since lapsed).
 *   • Candidates whose merchant already has a confirmed *or* ignored decision are
 *     suppressed, so a decided pattern never reappears as fresh detection noise.
 *
 * All derivation is memoized on the two query results and `now`, so it never
 * re-scans transactions on unrelated renders.
 */
export function useRecurring(now: Date): Result {
  const transactions = useTransactionsQuery();
  const recurring = useRecurringQuery();

  const data = useMemo<RecurringData | undefined>(() => {
    if (!transactions.data || !recurring.data) return undefined;

    const allTx = transactions.data;
    const rows = recurring.data;
    const currency = allTx[0]?.currency ?? 'USD';

    const candidates = detectRecurring(allTx, { now });

    // Any decided merchant (confirmed or ignored) suppresses future candidates.
    const decidedMerchants = new Set(
      rows
        .filter((r) => r.status === 'confirmed' || r.status === 'ignored')
        .map((r) => r.normalizedMerchant)
    );

    const confirmed: ConfirmedRecurring[] = rows
      .filter((r) => r.status === 'confirmed')
      .map((record) => {
        const live = candidates.find((c) => c.normalizedMerchant === record.normalizedMerchant);
        return {
          record,
          transactions: matchingTransactions(
            allTx,
            record.normalizedMerchant,
            record.expectedAmount
          ),
          nextExpectedDate: live?.nextExpectedDate ?? record.nextExpectedDate,
        };
      })
      .sort((a, b) => sortAmount(b) - sortAmount(a));

    const freshCandidates = candidates.filter((c) => !decidedMerchants.has(c.normalizedMerchant));

    const monthlyTotal = computeMonthlyRecurringTotal(
      confirmed.map((c) => ({
        expectedAmount: c.record.expectedAmount,
        frequency: c.record.frequency,
      }))
    );
    const annualEstimate = computeAnnualEstimate(monthlyTotal);
    const insights = generateRecurringInsights(
      confirmed.map((c) => ({
        merchant: c.record.merchant,
        expectedAmount: c.record.expectedAmount,
        frequency: c.record.frequency,
      })),
      currency
    );

    return {
      currency,
      confirmed,
      candidates: freshCandidates,
      monthlyTotal,
      annualEstimate,
      insights,
      isEmpty: confirmed.length === 0 && freshCandidates.length === 0,
    };
  }, [transactions.data, recurring.data, now]);

  return {
    isLoading: transactions.isLoading || recurring.isLoading,
    isError: transactions.isError || recurring.isError,
    data,
    refetch: () => {
      void transactions.refetch();
      void recurring.refetch();
    },
  };
}

function sortAmount(item: ConfirmedRecurring): number {
  return item.record.expectedAmount ?? 0;
}
