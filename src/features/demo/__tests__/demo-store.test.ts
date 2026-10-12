/// <reference types="jest" />
import { currentMonthKey } from '@/lib/month';

import { DemoStore } from '../demo-store';
import { generateDemoDataset } from '../demo-data';

const REF = new Date(2026, 5, 26, 12, 0, 0);

describe('DemoStore', () => {
  it('loads the deterministic dataset on construction', async () => {
    const store = new DemoStore(REF);
    const seeded = generateDemoDataset(REF);
    const txs = await store.fetchTransactions();
    expect(txs).toHaveLength(seeded.transactions.length);
  });

  it('returns transactions newest-first', async () => {
    const store = new DemoStore(REF);
    const txs = await store.fetchTransactions();
    for (let i = 1; i < txs.length; i += 1) {
      expect(new Date(txs[i - 1].date).getTime()).toBeGreaterThanOrEqual(
        new Date(txs[i].date).getTime()
      );
    }
  });

  it('adds a transaction to the in-memory data', async () => {
    const store = new DemoStore(REF);
    const before = (await store.fetchTransactions()).length;
    const created = await store.createTransaction({
      amount: 20,
      merchant: 'Test Cafe',
      category: 'Dining',
      date: new Date(2026, 5, 25).toISOString(),
    });
    const after = await store.fetchTransactions();
    expect(after).toHaveLength(before + 1);
    expect(after.find((t) => t.id === created.id)?.merchant).toBe('Test Cafe');
  });

  it('edits an existing transaction', async () => {
    const store = new DemoStore(REF);
    const [first] = await store.fetchTransactions();
    const updated = await store.updateTransaction({ id: first.id, amount: 999.99, merchant: 'Edited' });
    expect(updated.amount).toBe(999.99);
    expect(updated.merchant).toBe('Edited');
    const reread = (await store.fetchTransactions()).find((t) => t.id === first.id);
    expect(reread?.amount).toBe(999.99);
  });

  it('deletes a transaction and it affects derived totals', async () => {
    const store = new DemoStore(REF);
    const txs = await store.fetchTransactions();
    const target = txs[0];
    await store.deleteTransaction(target.id);
    const after = await store.fetchTransactions();
    expect(after.find((t) => t.id === target.id)).toBeUndefined();
    expect(after).toHaveLength(txs.length - 1);
  });

  it('reset() restores the original dataset after mutations', async () => {
    const store = new DemoStore(REF);
    const original = await store.fetchTransactions();
    await store.deleteTransaction(original[0].id);
    await store.createTransaction({
      amount: 5,
      merchant: 'Temp',
      category: 'Other',
      date: REF.toISOString(),
    });

    store.reset();
    const restored = await store.fetchTransactions();
    expect(restored).toHaveLength(original.length);
    expect(restored.find((t) => t.merchant === 'Temp')).toBeUndefined();
  });

  it('upserts a budget for the current month', async () => {
    const store = new DemoStore(REF);
    const key = currentMonthKey(REF);
    await store.upsertBudget({ monthKey: key, limit: 3000 });
    const budget = await store.fetchBudget(key);
    expect(budget?.limit).toBe(3000);
  });

  it('confirms a recurring candidate (upsert on merchant+frequency)', async () => {
    const store = new DemoStore(REF);
    const before = await store.fetchRecurringExpenses();
    const confirmed = await store.confirmRecurring({
      merchant: 'Adobe',
      normalizedMerchant: 'adobe',
      expectedAmount: 54.99,
      frequency: 'monthly',
    });
    expect(confirmed.status).toBe('confirmed');
    const after = await store.fetchRecurringExpenses();
    expect(after.length).toBe(before.length + 1);

    // Confirming the same pattern again flips in place — never duplicates.
    await store.ignoreRecurring({
      merchant: 'Adobe',
      normalizedMerchant: 'adobe',
      expectedAmount: 54.99,
      frequency: 'monthly',
    });
    const final = await store.fetchRecurringExpenses();
    expect(final.length).toBe(after.length);
    expect(final.find((r) => r.normalizedMerchant === 'adobe')?.status).toBe('ignored');
  });

  it('deletes a recurring record', async () => {
    const store = new DemoStore(REF);
    const [first] = await store.fetchRecurringExpenses();
    await store.deleteRecurring(first.id);
    const after = await store.fetchRecurringExpenses();
    expect(after.find((r) => r.id === first.id)).toBeUndefined();
  });

  it('isolates instances — mutating one store never affects another', async () => {
    const a = new DemoStore(REF);
    const b = new DemoStore(REF);
    const [first] = await a.fetchTransactions();
    await a.deleteTransaction(first.id);
    const bTxs = await b.fetchTransactions();
    expect(bTxs.find((t) => t.id === first.id)).toBeDefined();
  });

  it('seeds income and a declared balance', async () => {
    const store = new DemoStore(REF);
    expect((await store.fetchIncomeSources()).length).toBeGreaterThan(0);
    expect((await store.fetchBalanceSnapshots()).length).toBeGreaterThan(0);
  });

  it('creates, updates (re-deriving schedule), and deletes an income source', async () => {
    const store = new DemoStore(REF);
    const before = (await store.fetchIncomeSources()).length;

    const created = await store.createIncomeSource({
      name: 'Side gig',
      amountCents: 50000,
      frequency: 'monthly',
      startDate: '2026-06-01',
      dayOfMonth: 15,
    });
    expect(created.schedule).toEqual({ kind: 'monthly', dayOfMonth: 15 });
    expect((await store.fetchIncomeSources())).toHaveLength(before + 1);

    const updated = await store.updateIncomeSource({ id: created.id, dayOfMonth: 28, active: false });
    expect(updated.schedule).toEqual({ kind: 'monthly', dayOfMonth: 28 });
    expect(updated.active).toBe(false);

    await store.deleteIncomeSource(created.id);
    expect((await store.fetchIncomeSources()).find((i) => i.id === created.id)).toBeUndefined();
  });

  it('upserts a balance snapshot per effective date and deletes by id', async () => {
    const store = new DemoStore(REF);
    const first = await store.upsertBalanceSnapshot({ amountCents: 123456, effectiveDate: '2026-06-15' });
    const again = await store.upsertBalanceSnapshot({ amountCents: 222222, effectiveDate: '2026-06-15' });
    expect(again.id).toBe(first.id); // same date → replace, not duplicate
    expect(again.amountCents).toBe(222222);

    await store.deleteBalanceSnapshot(first.id);
    expect((await store.fetchBalanceSnapshots()).find((b) => b.id === first.id)).toBeUndefined();
  });

  it('reset() restores original income and balances after mutations', async () => {
    const store = new DemoStore(REF);
    const originalIncome = (await store.fetchIncomeSources()).length;
    const originalBalances = (await store.fetchBalanceSnapshots()).length;

    await store.createIncomeSource({ name: 'Temp', amountCents: 1, frequency: 'weekly', startDate: '2026-06-01' });
    await store.upsertBalanceSnapshot({ amountCents: 1, effectiveDate: '2026-06-20' });

    store.reset();
    expect(await store.fetchIncomeSources()).toHaveLength(originalIncome);
    expect(await store.fetchBalanceSnapshots()).toHaveLength(originalBalances);
    expect((await store.fetchIncomeSources()).find((i) => i.name === 'Temp')).toBeUndefined();
  });
});
