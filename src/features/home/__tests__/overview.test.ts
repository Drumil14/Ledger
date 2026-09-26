/// <reference types="jest" />
import { computeHomeOverview } from '@/features/home/overview';
import type { Budget, Transaction } from '@/types/transaction';

const budget: Budget = { id: 'b', month: '2026-09-01', limit: 2500, currency: 'USD' };
const now = new Date('2026-09-24T12:00:00');

const tx = (id: string, date: string, amount: number): Transaction => ({
  id,
  date,
  amount,
  currency: 'USD',
  merchant: id,
  category: 'Other',
  sourceType: 'manual',
});

const transactions: Transaction[] = [
  tx('a', '2026-09-24T09:00:00', 47.82),
  tx('b', '2026-09-24T13:00:00', 14.6),
  tx('c', '2026-09-10T10:00:00', 100),
  tx('d', '2026-08-15T10:00:00', 500), // previous month — excluded
];

describe('computeHomeOverview', () => {
  it('totals only the current month with a budget', () => {
    const overview = computeHomeOverview(transactions, budget, now);
    expect(overview.spent).toBeCloseTo(162.42, 2);
    expect(overview.hasBudget).toBe(true);
    expect(overview.limit).toBe(2500);
    expect(overview.remaining).toBeCloseTo(2337.58, 2);
    expect(overview.percentUsed).toBe(6);
    expect(overview.overBudget).toBe(false);
    expect(overview.monthLabel).toBe('September');
  });

  it('returns today’s transactions newest first, and a 7-day chart', () => {
    const overview = computeHomeOverview(transactions, budget, now);
    expect(overview.today.map((t) => t.id)).toEqual(['b', 'a']);
    expect(overview.chart).toHaveLength(7);
  });

  it('handles no budget distinctly from a zero balance', () => {
    const overview = computeHomeOverview(transactions, null, now);
    expect(overview.hasBudget).toBe(false);
    expect(overview.limit).toBeNull();
    expect(overview.remaining).toBeNull();
    expect(overview.percentUsed).toBeNull();
    expect(overview.progress).toBe(0);
    expect(overview.spent).toBeCloseTo(162.42, 2);
  });

  it('reports over-budget without capping the percentage', () => {
    const overview = computeHomeOverview(transactions, { ...budget, limit: 100 }, now);
    expect(overview.overBudget).toBe(true);
    expect(overview.overAmount).toBeCloseTo(62.42, 2);
    expect(overview.percentUsed).toBe(162);
    expect(overview.progress).toBe(1);
  });

  it('treats exactly at budget as not over', () => {
    const overview = computeHomeOverview(transactions, { ...budget, limit: 162.42 }, now);
    expect(overview.overBudget).toBe(false);
    expect(overview.remaining).toBe(0);
    expect(overview.percentUsed).toBe(100);
  });

  it('is empty with no transactions but keeps the budget', () => {
    const overview = computeHomeOverview([], budget, now);
    expect(overview.isEmpty).toBe(true);
    expect(overview.spent).toBe(0);
    expect(overview.remaining).toBe(2500);
    expect(overview.percentUsed).toBe(0);
    expect(overview.today).toHaveLength(0);
  });
});
