/// <reference types="jest" />
import { getDaySummary, getTransactionsForDay } from '@/features/home/day-summary';
import type { Transaction } from '@/types/transaction';

const tx = (id: string, date: string, amount: number): Transaction => ({
  id,
  date,
  amount,
  currency: 'USD',
  merchant: id,
  category: 'Other',
  sourceType: 'manual',
});

// Note: date strings without a trailing "Z" are parsed in LOCAL time by the JS
// Date constructor, which is exactly the convention Ledger relies on.
const transactions: Transaction[] = [
  tx('tj', '2026-09-23T10:14:00', 47.82),
  tx('chipotle', '2026-09-23T13:32:00', 18.4),
  tx('uber', '2026-09-23T20:06:00', 18.4),
  tx('late', '2026-09-23T23:30:00', 5), // late night — stays on the 23rd
  tx('nextday', '2026-09-24T00:15:00', 9), // just after midnight — the 24th
  tx('other', '2026-09-10T09:00:00', 100),
];

describe('getTransactionsForDay', () => {
  it('returns only the selected local calendar day', () => {
    const ids = getTransactionsForDay(transactions, new Date(2026, 8, 23, 12)).map((t) => t.id);
    expect(ids).toEqual(['late', 'uber', 'chipotle', 'tj']); // newest first
    expect(ids).not.toContain('nextday');
    expect(ids).not.toContain('other');
  });

  it('handles multiple transactions on the same day', () => {
    expect(getTransactionsForDay(transactions, new Date(2026, 8, 23)).length).toBe(4);
  });

  it('returns an empty list for a day with no expenses', () => {
    expect(getTransactionsForDay(transactions, new Date(2026, 8, 22))).toEqual([]);
  });

  it('does not bleed a late-night charge into the next day (timezone-safe)', () => {
    const day23 = getTransactionsForDay(transactions, new Date(2026, 8, 23)).map((t) => t.id);
    const day24 = getTransactionsForDay(transactions, new Date(2026, 8, 24)).map((t) => t.id);
    expect(day23).toContain('late');
    expect(day23).not.toContain('nextday');
    expect(day24).toEqual(['nextday']);
  });

  it('respects month boundaries', () => {
    const set = [
      tx('aug31', '2026-08-31T22:00:00', 10),
      tx('sep1', '2026-09-01T01:00:00', 20),
    ];
    expect(getTransactionsForDay(set, new Date(2026, 7, 31)).map((t) => t.id)).toEqual(['aug31']);
    expect(getTransactionsForDay(set, new Date(2026, 8, 1)).map((t) => t.id)).toEqual(['sep1']);
  });

  it('respects year boundaries', () => {
    const set = [
      tx('nye', '2025-12-31T23:00:00', 10),
      tx('nyd', '2026-01-01T00:30:00', 20),
    ];
    expect(getTransactionsForDay(set, new Date(2025, 11, 31)).map((t) => t.id)).toEqual(['nye']);
    expect(getTransactionsForDay(set, new Date(2026, 0, 1)).map((t) => t.id)).toEqual(['nyd']);
  });

  it('sorts newest first', () => {
    const ids = getTransactionsForDay(transactions, new Date(2026, 8, 23)).map((t) => t.id);
    expect(ids).toEqual(['late', 'uber', 'chipotle', 'tj']);
  });
});

describe('getDaySummary', () => {
  it('totals the day with exact cents (no float drift)', () => {
    const summary = getDaySummary(transactions, new Date(2026, 8, 23));
    expect(summary.total).toBe(89.62); // 47.82 + 18.40 + 18.40 + 5.00
    expect(summary.count).toBe(4);
    expect(summary.transactions.map((t) => t.id)).toEqual(['late', 'uber', 'chipotle', 'tj']);
  });

  it('avoids floating-point summing errors', () => {
    const set = [tx('a', '2026-09-23T10:00:00', 0.1), tx('b', '2026-09-23T11:00:00', 0.2)];
    expect(getDaySummary(set, new Date(2026, 8, 23)).total).toBe(0.3);
  });

  it('reports a zero-spend day cleanly', () => {
    const summary = getDaySummary(transactions, new Date(2026, 8, 22));
    expect(summary.total).toBe(0);
    expect(summary.count).toBe(0);
    expect(summary.transactions).toEqual([]);
  });
});
