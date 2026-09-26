/// <reference types="jest" />
import { computeBudgetStatus, sumSpendingForMonth } from '@/features/budgets/summary';
import type { Transaction } from '@/types/transaction';

describe('computeBudgetStatus', () => {
  it('reports no budget when limit is null', () => {
    const s = computeBudgetStatus(null, 100);
    expect(s).toMatchObject({
      hasBudget: false,
      limit: null,
      remaining: null,
      percentUsed: null,
      overBudget: false,
      overAmount: null,
      progress: 0,
    });
  });

  it('computes an under-budget status', () => {
    const s = computeBudgetStatus(2500, 1842.26);
    expect(s.remaining).toBeCloseTo(657.74, 2);
    expect(s.percentUsed).toBe(74);
    expect(s.overBudget).toBe(false);
    expect(s.progress).toBeCloseTo(0.7369, 3);
  });

  it('treats exactly at budget as not over', () => {
    const s = computeBudgetStatus(100, 100);
    expect(s.remaining).toBe(0);
    expect(s.percentUsed).toBe(100);
    expect(s.overBudget).toBe(false);
    expect(s.progress).toBe(1);
  });

  it('computes an over-budget status without capping percent', () => {
    const s = computeBudgetStatus(2500, 2650);
    expect(s.overBudget).toBe(true);
    expect(s.overAmount).toBeCloseTo(150, 2);
    expect(s.percentUsed).toBe(106);
    expect(s.progress).toBe(1);
  });

  it('handles zero spending', () => {
    const s = computeBudgetStatus(2500, 0);
    expect(s.remaining).toBe(2500);
    expect(s.percentUsed).toBe(0);
    expect(s.progress).toBe(0);
  });
});

const tx = (id: string, date: string, amount: number): Transaction => ({
  id,
  date,
  amount,
  currency: 'USD',
  merchant: id,
  category: 'Other',
  sourceType: 'manual',
});

describe('sumSpendingForMonth', () => {
  it('sums only the requested month, without float drift', () => {
    const transactions = [
      tx('a', '2026-09-01T10:00:00', 0.1),
      tx('b', '2026-09-30T10:00:00', 0.2),
      tx('c', '2026-08-15T10:00:00', 5),
    ];
    expect(sumSpendingForMonth(transactions, '2026-09')).toBe(0.3);
    expect(sumSpendingForMonth(transactions, '2026-08')).toBe(5);
    expect(sumSpendingForMonth(transactions, '2026-07')).toBe(0);
  });
});
