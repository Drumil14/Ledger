/// <reference types="jest" />
import { computeMonthComparison } from '@/features/insights/analytics';
import { computeBudgetStatus, sumSpendingForMonth } from '@/features/budgets/summary';
import { detectRecurring, normalizeMerchant } from '@/features/recurring/detection';
import { currentMonthKey, monthKeyFromDate, monthKeyFromStored, previousMonthKey } from '@/lib/month';

import { DEMO_BUDGET_LIMIT, generateDemoDataset } from '../demo-data';

// A fixed reference date so the deterministic assertions never depend on "now".
const REF = new Date(2026, 5, 26, 12, 0, 0); // 26 Jun 2026 — late enough to include all current-month items.

function categoryTotal(
  transactions: { category: string; amount: number; date: string }[],
  monthKey: string,
  category: string
): number {
  return transactions
    .filter((t) => monthKeyFromDate(new Date(t.date)) === monthKey && t.category === category)
    .reduce((sum, t) => sum + t.amount, 0);
}

describe('generateDemoDataset', () => {
  const dataset = generateDemoDataset(REF);
  const currentKey = currentMonthKey(REF);
  const previousKey = previousMonthKey(currentKey);

  it('is deterministic for a given reference date', () => {
    const a = JSON.stringify(generateDemoDataset(REF));
    const b = JSON.stringify(generateDemoDataset(REF));
    expect(a).toBe(b);
  });

  it('generates dates relative to the reference month (no hardcoded month)', () => {
    const months = new Set(dataset.transactions.map((t) => monthKeyFromDate(new Date(t.date))));
    expect(months.has(currentKey)).toBe(true);
    expect(months.has(previousKey)).toBe(true);
    expect(months.has(previousMonthKey(previousKey))).toBe(true);
    // Nothing is dated in the future.
    for (const t of dataset.transactions) {
      expect(new Date(t.date).getTime()).toBeLessThanOrEqual(REF.getTime());
    }
  });

  it('shifts correctly for a different reference year/month', () => {
    const other = generateDemoDataset(new Date(2027, 0, 20, 12, 0, 0)); // Jan 2027
    const months = new Set(other.transactions.map((t) => monthKeyFromDate(new Date(t.date))));
    expect(months.has('2027-01')).toBe(true);
    expect(months.has('2026-12')).toBe(true); // previous month rolls the year back
    expect(months.has('2026-11')).toBe(true);
  });

  it('seeds 15–25 transactions in the current month', () => {
    const count = dataset.transactions.filter(
      (t) => monthKeyFromDate(new Date(t.date)) === currentKey
    ).length;
    expect(count).toBeGreaterThanOrEqual(15);
    expect(count).toBeLessThanOrEqual(25);
  });

  it('places current-month budget usage in a healthy 65–80% range', () => {
    const spent = sumSpendingForMonth(dataset.transactions, currentKey);
    const status = computeBudgetStatus(DEMO_BUDGET_LIMIT, spent);
    expect(status.percentUsed).toBeGreaterThanOrEqual(65);
    expect(status.percentUsed).toBeLessThanOrEqual(80);
  });

  it('makes the current month slightly higher than the previous month', () => {
    const comparison = computeMonthComparison(dataset.transactions, currentKey);
    expect(comparison.direction).toBe('up');
    expect(comparison.previousHadSpending).toBe(true);
    // "Slightly" — within ~30% of the previous month, not a wild swing.
    expect(comparison.differencePercent).not.toBeNull();
    expect(comparison.differencePercent as number).toBeGreaterThan(0);
    expect(comparison.differencePercent as number).toBeLessThan(30);
  });

  it('produces the intended category deltas (dining up, shopping down)', () => {
    const diningNow = categoryTotal(dataset.transactions, currentKey, 'Dining');
    const diningPrev = categoryTotal(dataset.transactions, previousKey, 'Dining');
    expect(diningNow).toBeGreaterThan(diningPrev);

    const shoppingNow = categoryTotal(dataset.transactions, currentKey, 'Shopping');
    const shoppingPrev = categoryTotal(dataset.transactions, previousKey, 'Shopping');
    expect(shoppingNow).toBeLessThan(shoppingPrev);
  });

  it('gives the Home chart interesting days (a high day and zero-spend days)', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(REF);

    const dailyTotals: number[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dayStart = today - i * DAY_MS;
      const total = dataset.transactions
        .filter((t) => startOfDay(new Date(t.date)) === dayStart)
        .reduce((sum, t) => sum + t.amount, 0);
      dailyTotals.push(total);
    }
    expect(dailyTotals.some((v) => v === 0)).toBe(true); // at least one zero-spend day
    expect(Math.max(...dailyTotals)).toBeGreaterThan(80); // at least one noticeably higher day
  });

  it('seeds a $2,500 budget for the current month', () => {
    const budget = dataset.budgets.find((b) => monthKeyFromStored(b.month) === currentKey);
    expect(budget?.limit).toBe(2500);
  });

  it('seeds confirmed recurring subscriptions (Spotify, Netflix, gym)', () => {
    const confirmed = dataset.recurring.filter((r) => r.status === 'confirmed');
    const names = confirmed.map((r) => r.normalizedMerchant);
    expect(names).toEqual(expect.arrayContaining(['spotify', 'netflix', 'blink fitness']));
    for (const r of confirmed) {
      expect(r.frequency).toBe('monthly');
      expect(r.expectedAmount).not.toBeNull();
      expect(r.nextExpectedDate).toBeTruthy();
    }
  });

  it('leaves Adobe undecided so the detector surfaces it as a live candidate', () => {
    // Adobe is never confirmed/ignored in the seed…
    const decided = dataset.recurring.map((r) => r.normalizedMerchant);
    expect(decided).not.toContain('adobe');

    // …but the deterministic detector still finds it from transaction history.
    const candidates = detectRecurring(dataset.transactions, { now: REF });
    const adobe = candidates.find((c) => c.normalizedMerchant === normalizeMerchant('Adobe'));
    expect(adobe).toBeDefined();
    expect(adobe?.frequency).toBe('monthly');
  });
});
