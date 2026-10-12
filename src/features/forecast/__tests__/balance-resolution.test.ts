/// <reference types="jest" />
import { buildForecast } from '@/features/forecast/forecast';
import type { ForecastIncomeSource, ForecastInput } from '@/features/forecast/types';
import type { RecurringExpense } from '@/types/recurring';
import type { Transaction } from '@/types/transaction';

let seq = 0;
const tx = (date: string, amount: number): Transaction => ({
  id: `t${(seq += 1)}`,
  amount,
  currency: 'USD',
  merchant: 'Shop',
  category: 'Other',
  date,
  sourceType: 'manual',
});

const monthlyIncome = (amountCents: number, dayOfMonth: number): ForecastIncomeSource => ({
  id: 'inc',
  label: 'Pay',
  amountCents,
  schedule: { kind: 'monthly', dayOfMonth },
  startDate: '2025-01-01',
});

const ASOF = new Date(2026, 2, 15); // 2026-03-15

function run(partial: Partial<ForecastInput>): ReturnType<typeof buildForecast> {
  return buildForecast({
    asOf: ASOF,
    horizon: { kind: 'days', days: 10 }, // window is 2026-03-16 .. 2026-03-25
    transactions: [],
    recurring: [],
    income: [],
    currency: 'USD',
    ...partial,
  });
}

/**
 * Balance resolution policy: ONLY a balance the user declared FOR `asOf` itself
 * anchors an absolute projection. A non-current snapshot is never rolled forward
 * into a "current" balance, because Ledger cannot confirm that scheduled income
 * was received or that recorded spending is a complete record of account activity.
 */
describe('balance resolution — current declared balance only', () => {
  it('uses a same-day snapshot as a DECLARED (self-reported, not bank-verified) balance', () => {
    const result = run({ balance: { amountCents: 100000, asOfDate: '2026-03-15' } });
    expect(result.balanceBasis).toBe('declared');
    expect(result.currentBalanceCents).toBe(100000);
    expect(result.balanceAsOfDate).toBe('2026-03-15');
    expect(result.projectedBalanceCents).toBe(100000); // no activity in the window
    expect(result.warnings).not.toContain('stale-balance');
    expect(result.warnings).not.toContain('no-starting-balance');
  });

  it('handles an overdraft same-day balance and a negative projection', () => {
    const result = run({
      balance: { amountCents: -5000, asOfDate: '2026-03-15' }, // overdrawn
      recurring: [
        {
          id: 'r',
          merchant: 'Rent',
          normalizedMerchant: 'rent',
          expectedAmount: 100,
          frequency: 'monthly',
          nextExpectedDate: '2026-03-20',
          status: 'confirmed',
          source: 'manual',
        } as RecurringExpense,
      ],
    });
    expect(result.balanceBasis).toBe('declared');
    expect(result.currentBalanceCents).toBe(-5000);
    expect(result.projectedBalanceCents).toBe(-15000); // −5000 − 10000
  });
});

describe('balance resolution — scheduled income is never treated as received', () => {
  it('does NOT add unpaid scheduled income that fell before asOf to the current balance', () => {
    // A paycheck is SCHEDULED for Mar 5, inside the gap after the Mar-1 snapshot.
    // Ledger has no confirmation that it actually landed, so it must not inflate
    // the balance — the forecast falls back to relative.
    const result = run({
      balance: { amountCents: 200000, asOfDate: '2026-03-01' },
      income: [monthlyIncome(50000, 5)],
    });
    expect(result.balanceBasis).toBeNull();
    expect(result.currentBalanceCents).toBeNull();
    expect(result.projectedBalanceCents).toBeNull();
    expect(result.balanceAsOfDate).toBe('2026-03-01'); // provenance kept
    expect(result.warnings).toContain('stale-balance');
    expect(result.series.every((p) => p.projectedBalanceCents === null)).toBe(true);
  });

  it('keeps FUTURE scheduled income as a projection only, never folded into the current balance', () => {
    // With a current (same-day) balance, income scheduled later in the window is a
    // projected deposit — it lifts the PROJECTED balance but not the current one.
    const result = run({
      balance: { amountCents: 100000, asOfDate: '2026-03-15' },
      income: [monthlyIncome(50000, 20)], // Mar 20, inside the window
    });
    expect(result.currentBalanceCents).toBe(100000); // unchanged by scheduled income
    const incomeEvents = result.events.filter((e) => e.source === 'declared-income');
    expect(incomeEvents).toHaveLength(1);
    expect(incomeEvents[0].basis).toBe('scheduled'); // scheduled, not confirmed-received
    expect(result.projectedBalanceCents).toBe(150000); // projection includes it
  });
});

describe('balance resolution — incomplete / missing history', () => {
  it('does not fabricate a balance from a recent snapshot with NO recorded gap activity', () => {
    const result = run({
      balance: { amountCents: 200000, asOfDate: '2026-03-10' }, // 5 days before asOf
      transactions: [], // nothing recorded since — we must not imply a known balance
    });
    expect(result.balanceBasis).toBeNull();
    expect(result.currentBalanceCents).toBeNull();
    expect(result.projectedBalanceCents).toBeNull();
    expect(result.warnings).toContain('stale-balance');
  });

  it('refuses to reconcile even a one-day-old snapshot from incomplete expense records', () => {
    const result = run({
      balance: { amountCents: 200000, asOfDate: '2026-03-14' }, // yesterday
      transactions: [tx('2026-03-14', 20)], // recorded spend may be incomplete
    });
    expect(result.balanceBasis).toBeNull();
    expect(result.currentBalanceCents).toBeNull();
    expect(result.balanceAsOfDate).toBe('2026-03-14');
    expect(result.warnings).toContain('stale-balance');
  });
});

describe('balance resolution — stale and future snapshots', () => {
  it('treats a long-old snapshot as relative, preserving its date as provenance', () => {
    const result = run({ balance: { amountCents: 500000, asOfDate: '2025-10-01' } });
    expect(result.currentBalanceCents).toBeNull();
    expect(result.balanceBasis).toBeNull();
    expect(result.projectedBalanceCents).toBeNull();
    expect(result.balanceAsOfDate).toBe('2025-10-01'); // provenance kept
    expect(result.warnings).toContain('stale-balance');
  });

  it('does not use a future-dated snapshot as the current balance', () => {
    const result = run({ balance: { amountCents: 100000, asOfDate: '2026-03-20' } });
    expect(result.currentBalanceCents).toBeNull();
    expect(result.balanceBasis).toBeNull();
    expect(result.balanceAsOfDate).toBe('2026-03-20');
    expect(result.warnings).toContain('stale-balance');
  });
});

describe('balance resolution — no balance at all', () => {
  it('reports a relative forecast and warns no-starting-balance', () => {
    const result = run({ income: [monthlyIncome(50000, 20)] });
    expect(result.currentBalanceCents).toBeNull();
    expect(result.balanceBasis).toBeNull();
    expect(result.balanceAsOfDate).toBeNull();
    expect(result.projectedBalanceCents).toBeNull();
    expect(result.warnings).toContain('no-starting-balance');
    expect(result.warnings).not.toContain('stale-balance');
    // A relative forecast still has a net change and a continuous series.
    expect(result.series).not.toHaveLength(0);
    expect(result.series.every((p) => p.projectedBalanceCents === null)).toBe(true);
  });
});
