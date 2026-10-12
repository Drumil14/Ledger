/// <reference types="jest" />
import { estimateRunRate } from '@/features/forecast/run-rate';
import type { Transaction } from '@/types/transaction';

let seq = 0;
const tx = (merchant: string, date: string, amount: number): Transaction => ({
  id: `t${(seq += 1)}`,
  amount,
  currency: 'USD',
  merchant,
  category: 'Other',
  date,
  sourceType: 'manual',
});

const ASOF = new Date(2026, 0, 15); // 2026-01-15; run-rate looks at <= 2026-01-14
const NONE = new Set<string>();

// Five even $60 purchases, one per week, spanning exactly 30 days to yesterday.
const evenHistory = () => [
  tx('Coffee', '2026-01-14', 60),
  tx('Coffee', '2026-01-07', 60),
  tx('Coffee', '2025-12-31', 60),
  tx('Coffee', '2025-12-24', 60),
  tx('Coffee', '2025-12-16', 60),
];

describe('estimateRunRate', () => {
  it('averages discretionary spend over the covered span', () => {
    const result = estimateRunRate(evenHistory(), NONE, ASOF);
    expect(result).toEqual({
      dailyRunRateCents: 1000, // $300 over 30 days
      historyDays: 30,
      transactionCount: 5,
      irregular: false,
      insufficientHistory: false,
    });
  });

  it('excludes confirmed recurring merchants so they are never double counted', () => {
    const history = [
      ...evenHistory(),
      tx('Netflix', '2026-01-05', 15.49),
      tx('NETFLIX*1234', '2025-12-20', 15.49),
    ];
    const result = estimateRunRate(history, new Set(['netflix']), ASOF);
    expect(result.transactionCount).toBe(5);
    expect(result.dailyRunRateCents).toBe(1000);
  });

  it("excludes today's partial spend", () => {
    const result = estimateRunRate([...evenHistory(), tx('Coffee', '2026-01-15', 9999)], NONE, ASOF);
    expect(result.dailyRunRateCents).toBe(1000);
    expect(result.transactionCount).toBe(5);
  });

  it('flags insufficient history when the span is too short', () => {
    const history = [
      tx('Coffee', '2026-01-14', 30),
      tx('Coffee', '2026-01-10', 30),
      tx('Coffee', '2026-01-06', 30),
    ];
    const result = estimateRunRate(history, NONE, ASOF);
    expect(result.historyDays).toBe(9);
    expect(result.dailyRunRateCents).toBe(1000); // $90 / 9 days
    expect(result.insufficientHistory).toBe(true);
  });

  it('flags insufficient history when there are too few transactions', () => {
    const history = [tx('Coffee', '2025-12-16', 60), tx('Coffee', '2026-01-14', 60)];
    const result = estimateRunRate(history, NONE, ASOF);
    expect(result.transactionCount).toBe(2);
    expect(result.insufficientHistory).toBe(true);
  });

  it('returns a zero rate and insufficient flag for empty history', () => {
    expect(estimateRunRate([], NONE, ASOF)).toEqual({
      dailyRunRateCents: 0,
      historyDays: 0,
      transactionCount: 0,
      irregular: false,
      insufficientHistory: true,
    });
  });

  it('detects irregular spending via weekly variance', () => {
    const history = [
      tx('Splurge', '2026-01-14', 1000), // week 0
      tx('Coffee', '2026-01-07', 1), // week 1
      tx('Coffee', '2025-12-31', 1), // week 2
    ];
    const result = estimateRunRate(history, NONE, ASOF);
    expect(result.irregular).toBe(true);
    expect(result.insufficientHistory).toBe(false); // 15-day span, 3 txns
  });

  it('does not flag even weekly spend as irregular', () => {
    expect(estimateRunRate(evenHistory(), NONE, ASOF).irregular).toBe(false);
  });

  // Regression (Phase 2B audit): a merchant with BOTH a recurring charge and
  // one-off discretionary purchases. Exclusion is merchant-level (by design — no
  // speculative amount matching), so ALL of that merchant's spend is removed from
  // the run-rate. This documents the known undercount so the behavior can't change
  // silently: the $80 of discretionary Amazon spend below is intentionally dropped.
  it('excludes every transaction at a recurring merchant, even discretionary ones (documented undercount)', () => {
    const history = [
      ...evenHistory(), // $300 genuine discretionary → 1000¢/day baseline
      tx('Amazon', '2026-01-13', 15.99), // the actual recurring (Prime) charge
      tx('Amazon', '2026-01-09', 40.0), // one-off discretionary purchase
      tx('Amazon', '2025-12-28', 40.0), // one-off discretionary purchase
    ];

    const withExclusion = estimateRunRate(history, new Set(['amazon']), ASOF);
    // All three Amazon rows are dropped: only the 5 even purchases remain.
    expect(withExclusion.transactionCount).toBe(5);
    expect(withExclusion.dailyRunRateCents).toBe(1000);

    // For contrast, without treating Amazon as recurring, the $80 discretionary
    // spend IS counted — proving the undercount is exactly the excluded amount.
    const withoutExclusion = estimateRunRate(history, NONE, ASOF);
    expect(withoutExclusion.transactionCount).toBe(8);
    expect(withoutExclusion.dailyRunRateCents).toBeGreaterThan(withExclusion.dailyRunRateCents);
  });
});
