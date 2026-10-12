/// <reference types="jest" />
import { assembleForecastInput } from '@/features/forecast/assemble';
import { buildForecast } from '@/features/forecast/forecast';
import { balanceStaleness, horizonForId } from '@/features/forecast/view-model';
import type { BalanceSnapshot, IncomeSource } from '@/types/income';
import type { ForecastHorizon } from '@/features/forecast/types';
import type { Transaction } from '@/types/transaction';

let seq = 0;
const tx = (date: string, amount: number): Transaction => ({
  id: `t${(seq += 1)}`,
  amount,
  currency: 'USD',
  merchant: 'Coffee',
  category: 'Other',
  date,
  sourceType: 'manual',
});

const income: IncomeSource = {
  id: 'i',
  name: 'Salary',
  amountCents: 300000,
  currency: 'USD',
  schedule: { kind: 'monthly', dayOfMonth: 20 },
  startDate: '2025-01-01',
  endDate: null,
  active: true,
};

function build(asOf: Date, horizon: ForecastHorizon, balances: BalanceSnapshot[] = []) {
  const assembled = assembleForecastInput({
    transactions: [tx('2026-01-10', 60), tx('2026-01-03', 60), tx('2025-12-27', 60)],
    recurring: [],
    income: [income],
    balances,
    asOf,
    horizon,
  });
  if (!assembled.ok) throw new Error('expected ok');
  return { result: buildForecast(assembled.input), assembled };
}

describe('horizon switching', () => {
  const asOf = new Date(2026, 0, 15);

  it('produces different end dates and windows for 30-day vs end-of-month', () => {
    const days = build(asOf, horizonForId('days-30')).result;
    const monthEnd = build(asOf, horizonForId('month-end')).result;

    expect(days.horizonStart).toBe('2026-01-16');
    expect(days.horizonEnd).toBe('2026-02-14');

    expect(monthEnd.horizonStart).toBe('2026-01-16');
    expect(monthEnd.horizonEnd).toBe('2026-01-31');

    // The shorter window has fewer daily series points.
    expect(monthEnd.series.length).toBeLessThan(days.series.length);
  });
});

describe('as-of date changes', () => {
  it('shifts the forecast window when the day advances', () => {
    const horizon = horizonForId('days-30');
    const d15 = build(new Date(2026, 0, 15), horizon).result;
    const d20 = build(new Date(2026, 0, 20), horizon).result;

    expect(d15.horizonStart).toBe('2026-01-16');
    expect(d15.horizonEnd).toBe('2026-02-14');
    expect(d20.horizonStart).toBe('2026-01-21');
    expect(d20.horizonEnd).toBe('2026-02-19');
  });
});

describe('non-current balance handling', () => {
  const asOf = new Date(2026, 0, 15);

  it('does NOT project from a long-old balance — relative, with provenance', () => {
    const tooOld: BalanceSnapshot = {
      id: 'b',
      amountCents: 200000,
      currency: 'USD',
      effectiveDate: '2025-10-01', // ~106 days before asOf
    };
    const { result } = build(asOf, horizonForId('days-30'), [tooOld]);

    expect(result.projectedBalanceCents).toBeNull(); // never presented as current
    expect(result.balanceBasis).toBeNull();
    expect(result.balanceAsOfDate).toBe('2025-10-01'); // provenance preserved
    expect(result.warnings).toContain('stale-balance');
    expect(balanceStaleness('2025-10-01', asOf).isStale).toBe(true);
  });

  it('does NOT roll a recent (non-today) snapshot forward — relative, with provenance', () => {
    const recent: BalanceSnapshot = {
      id: 'b',
      amountCents: 300000,
      currency: 'USD',
      effectiveDate: '2025-12-20', // 26 days before asOf — recent, but not today
    };
    const { result } = build(asOf, horizonForId('days-30'), [recent]);

    // Scheduled income in the gap is unconfirmed and recorded expenses are not a
    // complete record, so the snapshot is NOT reconciled into a current balance.
    expect(result.balanceBasis).toBeNull();
    expect(result.currentBalanceCents).toBeNull();
    expect(result.projectedBalanceCents).toBeNull();
    expect(result.balanceAsOfDate).toBe('2025-12-20'); // provenance preserved
    expect(result.warnings).toContain('stale-balance');
  });

  it('reports a relative forecast when there is no balance', () => {
    const { result } = build(asOf, horizonForId('days-30'), []);
    expect(result.projectedBalanceCents).toBeNull();
    expect(result.balanceBasis).toBeNull();
    expect(result.warnings).toContain('no-starting-balance');
  });
});
