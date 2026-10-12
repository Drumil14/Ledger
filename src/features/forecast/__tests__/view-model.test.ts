/// <reference types="jest" />
import { assembleForecastInput } from '@/features/forecast/assemble';
import { buildForecast } from '@/features/forecast/forecast';
import {
  BALANCE_STALE_DAYS,
  balanceStaleness,
  buildForecastChart,
  confidenceCopy,
  forecastA11ySummary,
  groupForecastEvents,
  horizonForId,
  warningCopy,
} from '@/features/forecast/view-model';
import type { ForecastWarning } from '@/features/forecast/types';
import type { BalanceSnapshot, IncomeSource } from '@/types/income';
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

const evenHistory = () => [
  tx('Coffee', '2026-01-14', 60),
  tx('Groceries', '2026-01-07', 60),
  tx('Coffee', '2025-12-31', 60),
  tx('Lunch', '2025-12-24', 60),
  tx('Coffee', '2025-12-16', 60),
];

const income: IncomeSource = {
  id: 'inc1',
  name: 'Salary',
  amountCents: 300000,
  currency: 'USD',
  schedule: { kind: 'monthly', dayOfMonth: 31 },
  startDate: '2025-01-01',
  endDate: null,
  active: true,
};

const recurring: RecurringExpense[] = [
  { id: 'r1', merchant: 'Netflix', normalizedMerchant: 'netflix', expectedAmount: 15.49, frequency: 'monthly', nextExpectedDate: '2026-01-20', status: 'confirmed', source: 'detected' },
  { id: 'r2', merchant: 'Rent', normalizedMerchant: 'rent', expectedAmount: 1200, frequency: 'monthly', nextExpectedDate: '2026-02-01', status: 'confirmed', source: 'manual' },
];

const ASOF = new Date(2026, 0, 15);

function result(opts: { balance?: BalanceSnapshot[] } = {}) {
  const assembled = assembleForecastInput({
    transactions: evenHistory(),
    recurring,
    income: [income],
    balances: opts.balance ?? [{ id: 'b', amountCents: 500000, currency: 'USD', effectiveDate: '2026-01-15' }],
    asOf: ASOF,
    horizon: { kind: 'days', days: 31 },
  });
  if (!assembled.ok) throw new Error('expected ok');
  return buildForecast(assembled.input);
}

describe('horizonForId', () => {
  it('maps ids to engine horizons', () => {
    expect(horizonForId('days-30')).toEqual({ kind: 'days', days: 30 });
    expect(horizonForId('month-end')).toEqual({ kind: 'end-of-month' });
  });
});

describe('groupForecastEvents', () => {
  it('splits events into income, recurring and estimated with exact totals', () => {
    const groups = groupForecastEvents(result());
    expect(groups.income).toHaveLength(1);
    expect(groups.incomeTotalCents).toBe(300000);
    expect(groups.recurring).toHaveLength(2);
    expect(groups.recurringTotalCents).toBe(-121549); // −1549 − 120000
    expect(groups.estimatedDays).toBe(31);
    expect(groups.estimatedDailyCents).toBe(1000);
    expect(groups.estimatedTotalCents).toBe(-31000);
  });
});

describe('buildForecastChart', () => {
  it('builds a full + scheduled-only series against a real balance', () => {
    const chart = buildForecastChart(result());
    expect(chart.hasBalance).toBe(true);
    expect(chart.baselineCents).toBe(500000);
    expect(chart.points).toHaveLength(31);

    const last = chart.points[chart.points.length - 1];
    // Full = starting + net (incl. estimated): 500000 + 147451
    expect(last.fullCents).toBe(647451);
    // Scheduled-only excludes the −31000 estimated run-rate: 678451
    expect(last.scheduledCents).toBe(678451);
  });

  it('falls back to a relative (zero-baseline) series with no balance', () => {
    const chart = buildForecastChart(result({ balance: [] }));
    expect(chart.hasBalance).toBe(false);
    expect(chart.baselineCents).toBe(0);
    expect(chart.points[chart.points.length - 1].fullCents).toBe(147451); // net change
  });
});

describe('copy helpers', () => {
  it('gives confidence copy for each level', () => {
    expect(confidenceCopy('high').label).toBe('High confidence');
    expect(confidenceCopy('medium').label).toBe('Medium confidence');
    expect(confidenceCopy('low').label).toBe('Low confidence');
  });

  it('gives non-empty title and body for every warning', () => {
    const all: ForecastWarning[] = [
      'missing-income',
      'insufficient-history',
      'irregular-spending',
      'stale-recurrence',
      'stale-balance',
      'no-starting-balance',
    ];
    for (const w of all) {
      const copy = warningCopy(w);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });
});

describe('balanceStaleness', () => {
  it('reports a fresh balance as not stale', () => {
    expect(balanceStaleness('2026-01-01', ASOF)).toEqual({ daysOld: 14, isStale: false });
  });

  it('flags a balance older than the threshold', () => {
    const stale = balanceStaleness('2025-10-01', ASOF);
    expect(stale.daysOld).toBeGreaterThan(BALANCE_STALE_DAYS);
    expect(stale.isStale).toBe(true);
  });
});

describe('forecastA11ySummary', () => {
  it('summarizes direction and ending balance', () => {
    const summary = forecastA11ySummary(result(), (a) => `$${a.toFixed(2)}`);
    expect(summary).toContain('up');
    expect(summary).toContain('$6474.51');
  });

  it('notes relative mode when there is no balance', () => {
    expect(forecastA11ySummary(result({ balance: [] }), (a) => `$${a}`)).toContain('relative');
  });
});
