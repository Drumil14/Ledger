/// <reference types="jest" />
import { QueryClient } from '@tanstack/react-query';

import { balanceKeys } from '@/features/balances/queries';
import { incomeKeys } from '@/features/income/queries';

// The key factories transitively import the repositories → real services →
// Supabase client (AsyncStorage native module), which can't load under Jest.
// Stub it (hoisted above imports by jest); these tests only need the factories.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

/**
 * The income/balance mutation hooks invalidate `keys.all` on success. These tests
 * prove the invalidation CONTRACT: that `keys.all` is a prefix of the list key, so
 * invalidating `all` actually marks the list query stale (which drives the
 * forecast — composed from these queries — to refetch). This exercises our key
 * design with a real QueryClient, not a mock.
 */
describe('query invalidation keys', () => {
  it('income: invalidating .all marks the list query stale', async () => {
    const qc = new QueryClient();
    qc.setQueryData(incomeKeys.list(), []);
    expect(qc.getQueryState(incomeKeys.list())?.isInvalidated).toBe(false);

    await qc.invalidateQueries({ queryKey: incomeKeys.all });
    expect(qc.getQueryState(incomeKeys.list())?.isInvalidated).toBe(true);
    qc.clear();
  });

  it('balances: invalidating .all marks the list query stale', async () => {
    const qc = new QueryClient();
    qc.setQueryData(balanceKeys.list(), []);
    await qc.invalidateQueries({ queryKey: balanceKeys.all });
    expect(qc.getQueryState(balanceKeys.list())?.isInvalidated).toBe(true);
    qc.clear();
  });

  it('income and balance key namespaces do not collide', () => {
    expect(incomeKeys.all[0]).not.toBe(balanceKeys.all[0]);
  });
});
