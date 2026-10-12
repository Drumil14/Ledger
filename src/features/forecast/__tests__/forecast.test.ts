/// <reference types="jest" />
import { buildForecast } from '@/features/forecast/forecast';
import type { ForecastInput } from '@/features/forecast/types';
import type { RecurringExpense } from '@/types/recurring';
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

const rec = (over: Partial<RecurringExpense>): RecurringExpense => ({
  id: 'r',
  merchant: 'Merchant',
  normalizedMerchant: 'merchant',
  expectedAmount: 10,
  frequency: 'monthly',
  nextExpectedDate: '2026-02-01',
  status: 'confirmed',
  source: 'detected',
  ...over,
});

// $60/week discretionary spend → a clean $10/day run-rate over 30 days.
const evenHistory = () => [
  tx('Coffee', '2026-01-14', 60),
  tx('Groceries', '2026-01-07', 60),
  tx('Coffee', '2025-12-31', 60),
  tx('Lunch', '2025-12-24', 60),
  tx('Coffee', '2025-12-16', 60),
];

/** The headline, fully-specified example used in the report. */
function baseInput(): ForecastInput {
  return {
    asOf: new Date(2026, 0, 15),
    horizon: { kind: 'days', days: 31 },
    // Same-day snapshot ⇒ declared; used as-is (no roll-forward).
    balance: { amountCents: 500000, asOfDate: '2026-01-15' },
    income: [{ id: 'inc1', label: 'Salary', amountCents: 300000, schedule: { kind: 'monthly', dayOfMonth: 31 } }],
    recurring: [
      rec({ id: 'r1', merchant: 'Netflix', normalizedMerchant: 'netflix', expectedAmount: 15.49, nextExpectedDate: '2026-01-20' }),
      rec({ id: 'r2', merchant: 'Rent', normalizedMerchant: 'rent', expectedAmount: 1200, nextExpectedDate: '2026-02-01' }),
      // Ignored pattern must never be projected.
      rec({ id: 'r3', merchant: 'OldGym', normalizedMerchant: 'oldgym', expectedAmount: 40, nextExpectedDate: '2026-01-18', status: 'ignored' }),
    ],
    transactions: evenHistory(),
  };
}

describe('buildForecast — headline example', () => {
  const result = buildForecast(baseInput());

  it('frames the window as (asOf, horizonEnd]', () => {
    expect(result.asOf).toBe('2026-01-15');
    expect(result.horizonStart).toBe('2026-01-16');
    expect(result.horizonEnd).toBe('2026-02-15');
    expect(result.series).toHaveLength(31);
  });

  it('derives an exact daily run-rate from history', () => {
    expect(result.dailyRunRateCents).toBe(1000);
  });

  it('projects income exactly once (Jan 31; Feb 28 is past the window)', () => {
    const income = result.events.filter((e) => e.source === 'declared-income');
    expect(income).toEqual([
      {
        date: '2026-01-31',
        amountCents: 300000,
        direction: 'income',
        basis: 'scheduled',
        source: 'declared-income',
        label: 'Salary',
      },
    ]);
  });

  it('projects only confirmed recurring expenses', () => {
    const recurring = result.events.filter((e) => e.source === 'confirmed-recurring');
    expect(recurring).toEqual([
      { date: '2026-01-20', amountCents: -1549, direction: 'expense', basis: 'scheduled', source: 'confirmed-recurring', label: 'Netflix' },
      { date: '2026-02-01', amountCents: -120000, direction: 'expense', basis: 'scheduled', source: 'confirmed-recurring', label: 'Rent' },
    ]);
  });

  it('emits one estimated run-rate outflow per window day', () => {
    const estimated = result.events.filter((e) => e.source === 'historical-average');
    expect(estimated).toHaveLength(31);
    expect(estimated.every((e) => e.amountCents === -1000 && e.basis === 'estimated')).toBe(true);
    expect(result.events).toHaveLength(34); // 1 income + 2 recurring + 31 run-rate
  });

  it('computes an exact net change and projected balance', () => {
    // +300000 − 1549 − 120000 − 31000 = 147451
    expect(result.netChangeCents).toBe(147451);
    expect(result.projectedBalanceCents).toBe(647451);
  });

  it('builds a correct cumulative daily balance series', () => {
    const first = result.series[0];
    expect(first).toEqual({ date: '2026-01-16', netChangeCents: -1000, projectedBalanceCents: 499000 });

    const jan31 = result.series.find((p) => p.date === '2026-01-31');
    // 16 run-rate days (−16000) − Netflix 1549 + Salary 300000 = 282451
    expect(jan31).toEqual({ date: '2026-01-31', netChangeCents: 282451, projectedBalanceCents: 782451 });

    const last = result.series[result.series.length - 1];
    expect(last).toEqual({ date: '2026-02-15', netChangeCents: 147451, projectedBalanceCents: 647451 });
  });

  it('reports high confidence and no warnings for healthy inputs', () => {
    expect(result.confidence).toBe('high');
    expect(result.warnings).toEqual([]);
  });

  it('is deterministic for identical inputs', () => {
    expect(buildForecast(baseInput())).toEqual(buildForecast(baseInput()));
  });
});

describe('buildForecast — balance handling', () => {
  it('returns a relative forecast (null balances) when no starting balance is given', () => {
    const { balance, ...rest } = baseInput();
    void balance;
    const result = buildForecast(rest);

    expect(result.projectedBalanceCents).toBeNull();
    expect(result.series.every((p) => p.projectedBalanceCents === null)).toBe(true);
    expect(result.netChangeCents).toBe(147451); // net change is unaffected
    expect(result.warnings).toEqual(['no-starting-balance']);
    expect(result.confidence).toBe('high'); // a missing balance does not lower confidence
  });
});

describe('buildForecast — warnings & confidence', () => {
  it('warns about missing income and yields a negative net cash flow', () => {
    const result = buildForecast({
      asOf: new Date(2026, 0, 1),
      horizon: { kind: 'days', days: 31 },
      balance: { amountCents: 50000, asOfDate: '2026-01-01' },
      income: [],
      recurring: [rec({ merchant: 'Rent', normalizedMerchant: 'rent', expectedAmount: 2000, nextExpectedDate: '2026-01-15' })],
      transactions: [
        tx('Coffee', '2025-12-31', 60),
        tx('Coffee', '2025-12-24', 60),
        tx('Coffee', '2025-12-17', 60),
        tx('Coffee', '2025-12-10', 60),
        tx('Coffee', '2025-12-02', 60),
      ],
    });

    // −200000 rent − 31000 run-rate (31 days × −1000) = −231000
    expect(result.netChangeCents).toBe(-231000);
    expect(result.projectedBalanceCents).toBe(-181000); // balance is allowed to go negative
    expect(result.warnings).toEqual(['missing-income']);
    expect(result.confidence).toBe('medium');
  });

  it('is low confidence with the expected warning order when history is thin', () => {
    const result = buildForecast({
      asOf: new Date(2026, 0, 15),
      horizon: { kind: 'days', days: 14 },
      income: [],
      recurring: [],
      transactions: [tx('Coffee', '2026-01-14', 60)],
    });

    expect(result.confidence).toBe('low');
    expect(result.warnings).toEqual(['missing-income', 'insufficient-history', 'no-starting-balance']);
  });

  it('warns about stale recurrence but still projects it, at medium confidence', () => {
    const result = buildForecast({
      asOf: new Date(2026, 0, 15),
      horizon: { kind: 'days', days: 31 },
      balance: { amountCents: 100000, asOfDate: '2026-01-15' },
      income: [{ id: 'i', label: 'Pay', amountCents: 200000, schedule: { kind: 'monthly', dayOfMonth: 1 } }],
      recurring: [rec({ merchant: 'Gym', normalizedMerchant: 'gym', expectedAmount: 50, nextExpectedDate: '2025-12-01' })],
      transactions: evenHistory(),
    });

    expect(result.warnings).toContain('stale-recurrence');
    expect(result.confidence).toBe('medium');
    expect(result.events.some((e) => e.source === 'confirmed-recurring' && e.label === 'Gym')).toBe(true);
  });
});

describe('buildForecast — boundaries', () => {
  it('handles an empty window (end-of-month on the last day)', () => {
    const result = buildForecast({
      asOf: new Date(2026, 0, 31),
      horizon: { kind: 'end-of-month' },
      balance: { amountCents: 500000, asOfDate: '2026-01-31' },
      income: [{ id: 'i', label: 'Pay', amountCents: 200000, schedule: { kind: 'monthly', dayOfMonth: 1 } }],
      recurring: [],
      transactions: evenHistory(),
    });

    expect(result.horizonStart).toBe('2026-02-01');
    expect(result.horizonEnd).toBe('2026-01-31');
    expect(result.events).toEqual([]);
    expect(result.series).toEqual([]);
    expect(result.netChangeCents).toBe(0);
    expect(result.projectedBalanceCents).toBe(500000); // unchanged, never invented
  });

  it('forecasts across a year boundary', () => {
    const result = buildForecast({
      asOf: new Date(2026, 11, 20), // 2026-12-20
      horizon: { kind: 'days', days: 20 },
      income: [],
      recurring: [rec({ merchant: 'Rent', normalizedMerchant: 'rent', expectedAmount: 1000, nextExpectedDate: '2027-01-01' })],
      transactions: [],
    });

    expect(result.horizonStart).toBe('2026-12-21');
    expect(result.horizonEnd).toBe('2027-01-09');
    const rentEvent = result.events.find((e) => e.label === 'Rent');
    expect(rentEvent?.date).toBe('2027-01-01');
  });
});
