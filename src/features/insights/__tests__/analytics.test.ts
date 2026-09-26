/// <reference types="jest" />
import {
  computeCategoryComparison,
  computeCategoryTotals,
  computeCumulativeSeries,
  computeMonthComparison,
  computeMonthlySpend,
  computeProjection,
  computeSpendingPace,
  computeWeekendSpending,
  generateDeterministicInsights,
  getLargestTransactions,
  getTransactionsForMonth,
  type InsightContext,
} from '@/features/insights/analytics';
import { computeBudgetStatus } from '@/features/budgets/summary';
import type { Transaction } from '@/types/transaction';

const tx = (
  id: string,
  date: string,
  amount: number,
  category = 'Other',
  merchant = id
): Transaction => ({
  id,
  date,
  amount,
  currency: 'USD',
  merchant,
  category,
  sourceType: 'manual',
});

// A fixed "today" in the middle of September 2026 (Sep 15 is a Tuesday).
const NOW = new Date('2026-09-15T12:00:00');

/**
 * Fixture: September 2026 (current) and August 2026 (previous), plus one July
 * row that must never leak into September/August math.
 */
const transactions: Transaction[] = [
  // September (current month)
  tx('s1', '2026-09-02T10:00:00', 436, 'Dining', 'Dining early'), // Wed
  tx('s2', '2026-09-05T10:00:00', 186.4, 'Shopping', 'Uniqlo'), // Sat (weekend)
  tx('s3', '2026-09-06T10:00:00', 132.6, 'Shopping', 'Trader Joes'), // Sun (weekend)
  tx('s4', '2026-09-10T10:00:00', 286, 'Groceries', 'Groceries'), // Thu
  tx('s5', '2026-09-14T10:00:00', 182, 'Transport', 'Transit'), // Mon
  // Late-September row: after "today" (Sep 15) — excluded from pace/projection.
  tx('s6', '2026-09-28T10:00:00', 500, 'Travel', 'Delta'), // Mon
  // August (previous month)
  tx('a1', '2026-08-03T10:00:00', 350, 'Dining', 'Dining'),
  tx('a2', '2026-08-08T10:00:00', 361, 'Shopping', 'Shopping'),
  tx('a3', '2026-08-20T10:00:00', 200, 'Transport', 'Transport'),
  // July — must be ignored entirely
  tx('j1', '2026-07-10T10:00:00', 999, 'Other', 'July'),
];

describe('getTransactionsForMonth', () => {
  it('selects only the requested month', () => {
    expect(getTransactionsForMonth(transactions, '2026-09').map((t) => t.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
      's5',
      's6',
    ]);
    expect(getTransactionsForMonth(transactions, '2026-08').map((t) => t.id)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
    expect(getTransactionsForMonth(transactions, '2026-01')).toHaveLength(0);
  });
});

describe('computeMonthlySpend', () => {
  it('totals a month with exact cents (no float drift)', () => {
    expect(computeMonthlySpend(transactions, '2026-09')).toBeCloseTo(1723, 2);
    expect(computeMonthlySpend(transactions, '2026-08')).toBe(911);
  });

  it('is 0 for a month with no transactions', () => {
    expect(computeMonthlySpend(transactions, '2026-05')).toBe(0);
  });

  it('adds fractional cents without drift', () => {
    const t = [tx('x', '2026-09-01T10:00:00', 0.1), tx('y', '2026-09-02T10:00:00', 0.2)];
    expect(computeMonthlySpend(t, '2026-09')).toBe(0.3);
  });
});

describe('computeMonthComparison', () => {
  it('compares current and previous month totals', () => {
    const c = computeMonthComparison(transactions, '2026-09');
    expect(c.currentTotal).toBe(1723);
    expect(c.previousTotal).toBe(911);
    expect(c.differenceAmount).toBe(812);
    expect(c.differencePercent).toBe(89); // round(812/911*100)
    expect(c.direction).toBe('up');
    expect(c.previousHadSpending).toBe(true);
  });

  it('reports a decrease as "down"', () => {
    const c = computeMonthComparison(transactions, '2026-08'); // Aug 911 vs Jul 999
    expect(c.direction).toBe('down');
    expect(c.differenceAmount).toBe(-88);
    expect(c.differencePercent).toBe(-9);
  });

  it('never returns Infinity when the previous month was 0', () => {
    const c = computeMonthComparison(transactions, '2026-07'); // Jul 999 vs Jun 0
    expect(c.previousTotal).toBe(0);
    expect(c.differencePercent).toBeNull(); // never Infinity%
    expect(c.direction).toBe('up'); // spending from a zero baseline is still an increase
    expect(c.previousHadSpending).toBe(false); // …but callers know there's no baseline
  });

  it('handles both months being zero', () => {
    const c = computeMonthComparison(transactions, '2026-05'); // May 0 vs Apr 0
    expect(c.currentTotal).toBe(0);
    expect(c.previousTotal).toBe(0);
    expect(c.differencePercent).toBeNull();
    expect(c.direction).toBe('unavailable');
    expect(c.previousHadSpending).toBe(false);
  });

  it('walks across a year boundary (January → previous December)', () => {
    const t = [
      tx('jan', '2026-01-10T10:00:00', 100),
      tx('dec', '2025-12-10T10:00:00', 40),
    ];
    const c = computeMonthComparison(t, '2026-01');
    expect(c.currentTotal).toBe(100);
    expect(c.previousTotal).toBe(40);
    expect(c.direction).toBe('up');
    expect(c.differencePercent).toBe(150);
  });
});

describe('computeCategoryTotals', () => {
  it('totals, counts, and percentages per category, sorted descending', () => {
    const totals = computeCategoryTotals(transactions, '2026-09');
    expect(totals.map((c) => c.category)).toEqual([
      'Travel', // 500
      'Dining', // 436
      'Shopping', // 319
      'Groceries', // 286
      'Transport', // 182
    ]);
    const dining = totals.find((c) => c.category === 'Dining')!;
    expect(dining.total).toBe(436);
    expect(dining.count).toBe(1);
    expect(dining.percent).toBe(25); // round(436/1723*100)

    const shopping = totals.find((c) => c.category === 'Shopping')!;
    expect(shopping.total).toBe(319); // 186.40 + 132.60
    expect(shopping.count).toBe(2);
  });

  it('omits categories with no spending and is empty for an empty month', () => {
    const totals = computeCategoryTotals(transactions, '2026-09');
    expect(totals.find((c) => c.category === 'Bills')).toBeUndefined();
    expect(computeCategoryTotals(transactions, '2026-05')).toEqual([]);
  });
});

describe('computeCategoryComparison', () => {
  it('compares each category against the previous month, largest movement first', () => {
    const comparison = computeCategoryComparison(transactions, '2026-09');
    const dining = comparison.find((c) => c.category === 'Dining')!;
    expect(dining.currentAmount).toBe(436);
    expect(dining.previousAmount).toBe(350);
    expect(dining.differenceAmount).toBe(86);
    expect(dining.direction).toBe('up');

    const shopping = comparison.find((c) => c.category === 'Shopping')!;
    expect(shopping.differenceAmount).toBe(-42); // 319 − 361
    expect(shopping.direction).toBe('down');

    const transport = comparison.find((c) => c.category === 'Transport')!;
    expect(transport.differenceAmount).toBe(-18); // 182 − 200
  });

  it('includes new categories safely (previous 0 → null percent, direction up)', () => {
    const comparison = computeCategoryComparison(transactions, '2026-09');
    const groceries = comparison.find((c) => c.category === 'Groceries')!;
    expect(groceries.previousAmount).toBe(0);
    expect(groceries.differencePercent).toBeNull();
    expect(groceries.direction).toBe('up');
  });
});

describe('computeSpendingPace', () => {
  it('compares the partial current month against the previous month over the SAME days', () => {
    // Through Sep 15: s1..s5 = 1223 (s6 on Sep 28 excluded).
    // August days ≤ 15: a1 (Aug 3) + a2 (Aug 8) = 711 (a3 on Aug 20 excluded).
    const pace = computeSpendingPace(transactions, '2026-09', NOW);
    expect(pace.isPartial).toBe(true);
    expect(pace.throughDay).toBe(15);
    expect(pace.currentSpendToDate).toBe(1223);
    expect(pace.previousSpendToSameDay).toBe(711);
    expect(pace.differenceAmount).toBe(512);
    expect(pace.direction).toBe('up');
  });

  it('compares full month vs full previous month for a historical month', () => {
    const pace = computeSpendingPace(transactions, '2026-08', NOW);
    expect(pace.isPartial).toBe(false);
    expect(pace.throughDay).toBe(31); // August has 31 days
    expect(pace.currentSpendToDate).toBe(911);
    expect(pace.previousSpendToSameDay).toBe(999); // full July
    expect(pace.direction).toBe('down');
  });
});

describe('computeProjection', () => {
  it('projects from the current month when eligible', () => {
    // Spend through the whole current month in the data = 1723 across 6 tx,
    // day 15 of 30. daily = 1723/15 = 114.8667 → projected = ×30 = 3446.
    const p = computeProjection(transactions, '2026-09', NOW);
    expect(p.eligible).toBe(true);
    expect(p.daysElapsed).toBe(15);
    expect(p.daysInMonth).toBe(30);
    expect(p.dailyAverage).toBeCloseTo(114.87, 2);
    expect(p.projected).toBeCloseTo(3446, 0);
  });

  it('is not eligible before 5 days have elapsed', () => {
    const early = new Date('2026-09-03T12:00:00');
    const p = computeProjection(transactions, '2026-09', early);
    expect(p.eligible).toBe(false);
    expect(p.projected).toBeNull();
  });

  it('is not eligible with fewer than 3 transactions', () => {
    const sparse = [tx('o1', '2026-09-02T10:00:00', 10), tx('o2', '2026-09-10T10:00:00', 20)];
    const p = computeProjection(sparse, '2026-09', NOW);
    expect(p.eligible).toBe(false);
    expect(p.projected).toBeNull();
  });

  it('never projects a completed historical month', () => {
    const p = computeProjection(transactions, '2026-08', NOW);
    expect(p.eligible).toBe(false);
    expect(p.projected).toBeNull();
    expect(p.daysInMonth).toBe(31);
  });
});

describe('getLargestTransactions', () => {
  it('returns the biggest transactions for the month, largest first', () => {
    const largest = getLargestTransactions(transactions, '2026-09', 3);
    expect(largest.map((t) => t.id)).toEqual(['s6', 's1', 's4']); // 500, 436, 286
  });

  it('caps at the requested limit and never bleeds other months', () => {
    const largest = getLargestTransactions(transactions, '2026-08', 10);
    expect(largest.map((t) => t.id)).toEqual(['a2', 'a1', 'a3']); // 361, 350, 200
  });
});

describe('computeWeekendSpending', () => {
  it('splits weekend vs weekday spending and computes the weekend share', () => {
    // Sep weekend rows: s2 (Sat, 186.40) + s3 (Sun, 132.60) = 319 of 1723.
    const w = computeWeekendSpending(transactions, '2026-09');
    expect(w.weekend).toBe(319);
    expect(w.weekday).toBe(1404);
    expect(w.weekendShare).toBe(19); // round(319/1723*100)
  });

  it('is 0% for an empty month', () => {
    const w = computeWeekendSpending(transactions, '2026-05');
    expect(w).toEqual({ weekend: 0, weekday: 0, weekendShare: 0 });
  });
});

describe('computeCumulativeSeries', () => {
  it('builds monotonic cumulative series, stopping the current month at today', () => {
    const series = computeCumulativeSeries(transactions, '2026-09', NOW);
    expect(series.totalDays).toBe(30);
    // Current series stops at day 15 (today), so s6 (Sep 28) is not included.
    expect(series.current).toHaveLength(15);
    expect(series.current[series.current.length - 1].value).toBe(1223);
    // Non-decreasing.
    for (let i = 1; i < series.current.length; i += 1) {
      expect(series.current[i].value).toBeGreaterThanOrEqual(series.current[i - 1].value);
    }
    // Previous month capped to the current month's day count.
    expect(series.previous.length).toBeLessThanOrEqual(30);
    expect(series.previous[series.previous.length - 1].value).toBe(911);
  });

  it('runs a historical month over its full length', () => {
    const series = computeCumulativeSeries(transactions, '2026-08', NOW);
    expect(series.totalDays).toBe(31);
    expect(series.current).toHaveLength(31);
    expect(series.current[series.current.length - 1].value).toBe(911);
  });
});

/* -------------------------------------------------------------------------- */
/* Deterministic insights                                                     */
/* -------------------------------------------------------------------------- */

function buildContext(monthKey: string, now: Date, limit: number): InsightContext {
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    new Date(`${monthKey}-01T00:00:00`)
  );
  const monthSpend = computeMonthlySpend(transactions, monthKey);
  const budget = computeBudgetStatus(2500, monthSpend);
  return {
    monthKey,
    now,
    currency: 'USD',
    monthName,
    comparison: computeMonthComparison(transactions, monthKey),
    pace: computeSpendingPace(transactions, monthKey, now),
    categoryTotals: computeCategoryTotals(transactions, monthKey),
    categoryComparison: computeCategoryComparison(transactions, monthKey),
    largest: getLargestTransactions(transactions, monthKey, limit),
    weekend: computeWeekendSpending(transactions, monthKey),
    budget,
    monthSpend,
    transactionCount: getTransactionsForMonth(transactions, monthKey).length,
  };
}

describe('generateDeterministicInsights', () => {
  it('produces 3–5 prioritized, data-backed observations', () => {
    const insights = generateDeterministicInsights(buildContext('2026-09', NOW, 5));
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.length).toBeLessThanOrEqual(5);

    // Highest-priority slot is the (partial-month) pace comparison.
    expect(insights[0].text).toMatch(/at this point last month/);
    // The largest category increase is surfaced (Travel, +$500, a new category).
    expect(insights.some((i) => /\$500\.00 more on Travel/.test(i.text))).toBe(true);
    // Budget line present.
    expect(insights.some((i) => i.id === 'budget')).toBe(true);
    // Every insight is non-empty.
    for (const i of insights) expect(i.text.length).toBeGreaterThan(0);
  });

  it('uses same-day pace copy for the current month, not partial-vs-full', () => {
    const insights = generateDeterministicInsights(buildContext('2026-09', NOW, 5));
    const pace = insights.find((i) => i.id === 'pace');
    expect(pace?.text).toBe(
      'Your spending is $512.00 higher than it was at this point last month.'
    );
  });

  it('suppresses trivial differences below the threshold', () => {
    const trivial = [
      tx('c1', '2026-09-02T10:00:00', 100, 'Groceries'),
      tx('c2', '2026-09-03T10:00:00', 50, 'Dining'),
      tx('c3', '2026-09-04T10:00:00', 20, 'Transport'),
      tx('p1', '2026-08-02T10:00:00', 99, 'Groceries'), // Δ +$1 — trivial
      tx('p2', '2026-08-03T10:00:00', 49, 'Dining'), // Δ +$1 — trivial
    ];
    const now = new Date('2026-09-10T12:00:00');
    const ctx: InsightContext = {
      monthKey: '2026-09',
      now,
      currency: 'USD',
      monthName: 'September',
      comparison: computeMonthComparison(trivial, '2026-09'),
      pace: computeSpendingPace(trivial, '2026-09', now),
      categoryTotals: computeCategoryTotals(trivial, '2026-09'),
      categoryComparison: computeCategoryComparison(trivial, '2026-09'),
      largest: getLargestTransactions(trivial, '2026-09', 5),
      weekend: computeWeekendSpending(trivial, '2026-09'),
      budget: computeBudgetStatus(null, computeMonthlySpend(trivial, '2026-09')),
      monthSpend: computeMonthlySpend(trivial, '2026-09'),
      transactionCount: 3,
    };
    const insights = generateDeterministicInsights(ctx);
    // No "+$1 more on Groceries" style noise.
    expect(insights.some((i) => i.id === 'category-increase')).toBe(false);
  });

  it('reports an over-budget status when applicable', () => {
    const monthSpend = computeMonthlySpend(transactions, '2026-09');
    const ctx = buildContext('2026-09', NOW, 5);
    ctx.budget = computeBudgetStatus(1000, monthSpend); // 1723 spent → over
    const insights = generateDeterministicInsights(ctx);
    expect(insights.some((i) => /over your September budget/.test(i.text))).toBe(true);
  });
});
