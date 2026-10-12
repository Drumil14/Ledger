/// <reference types="jest" />
import { assembleForecastInput } from '@/features/forecast/assemble';
import { buildForecast } from '@/features/forecast/forecast';
import type { BalanceSnapshot, IncomeSource } from '@/types/income';
import type { RecurringExpense } from '@/types/recurring';
import type { Transaction } from '@/types/transaction';

const ASOF = new Date(2026, 0, 15);

const income = (over: Partial<IncomeSource>): IncomeSource => ({
  id: 'i',
  name: 'Paycheck',
  amountCents: 200000,
  currency: 'USD',
  schedule: { kind: 'monthly', dayOfMonth: 1 },
  startDate: '2025-01-01',
  endDate: null,
  active: true,
  ...over,
});

const balance = (over: Partial<BalanceSnapshot>): BalanceSnapshot => ({
  id: 'b',
  amountCents: 500000,
  currency: 'USD',
  effectiveDate: '2026-01-01',
  ...over,
});

const base = {
  transactions: [] as Transaction[],
  recurring: [] as RecurringExpense[],
  income: [] as IncomeSource[],
  balances: [] as BalanceSnapshot[],
  asOf: ASOF,
  horizon: { kind: 'days', days: 40 } as const,
};

describe('assembleForecastInput — assembly', () => {
  it('maps active income, picks a balance, and feeds buildForecast end to end', () => {
    const result = assembleForecastInput({
      ...base,
      income: [
        income({ id: 'paycheck', name: 'Paycheck', schedule: { kind: 'monthly', dayOfMonth: 1 } }),
        income({ id: 'bonus', name: 'Bonus', amountCents: 50000, schedule: { kind: 'one-time', date: '2026-02-10' }, startDate: '2026-02-10' }),
        // Inactive income must never be projected.
        income({ id: 'oldjob', name: 'Old job', amountCents: 999999, active: false }),
      ],
      // Dated on asOf so it anchors an absolute projection (no roll-forward).
      balances: [balance({ amountCents: 500000, effectiveDate: '2026-01-15' })],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.isEmpty).toBe(false);
    expect(result.input.income).toHaveLength(2); // inactive dropped
    expect(result.input.balance?.amountCents).toBe(500000);
    expect(result.input.currency).toBe('USD');

    // Feb 1 paycheck (+200000) and Feb 10 bonus (+50000); no transactions → run-rate 0.
    const forecast = buildForecast(result.input);
    expect(forecast.netChangeCents).toBe(250000);
    expect(forecast.projectedBalanceCents).toBe(750000);
    expect(forecast.events.filter((e) => e.source === 'declared-income')).toHaveLength(2);
  });

  it('picks the latest balance on or before asOf and ignores future snapshots', () => {
    const result = assembleForecastInput({
      ...base,
      horizon: { kind: 'days', days: 5 },
      balances: [
        balance({ id: 'old', amountCents: 500000, effectiveDate: '2026-01-01' }),
        balance({ id: 'recent', amountCents: 600000, effectiveDate: '2026-01-15' }), // on asOf
        balance({ id: 'future', amountCents: 999999, effectiveDate: '2026-02-01' }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.balance?.amountCents).toBe(600000); // latest on/before asOf, future ignored
    expect(buildForecast(result.input).projectedBalanceCents).toBe(600000); // current balance, no activity
  });

  it('yields a relative forecast (null balance) and warning when no snapshot exists', () => {
    const result = assembleForecastInput({ ...base, income: [income({})] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.balance).toBeUndefined();
    const forecast = buildForecast(result.input);
    expect(forecast.projectedBalanceCents).toBeNull();
    expect(forecast.warnings).toContain('no-starting-balance');
  });

  it('flags an empty forecast when there is nothing to project from', () => {
    const result = assembleForecastInput(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isEmpty).toBe(true);
  });
});

describe('assembleForecastInput — currency safety', () => {
  it('refuses to combine income and balance in different currencies', () => {
    const result = assembleForecastInput({
      ...base,
      income: [income({ currency: 'EUR' })],
      balances: [balance({ currency: 'USD' })],
    });
    expect(result).toEqual({ ok: false, reason: 'currency-mismatch', currencies: ['EUR', 'USD'] });
  });

  it('refuses when transactions span multiple currencies', () => {
    const tx = (currency: string): Transaction => ({
      id: `t-${currency}`,
      amount: 10,
      currency,
      merchant: 'Shop',
      category: 'Other',
      date: '2026-01-05',
      sourceType: 'manual',
    });
    const result = assembleForecastInput({ ...base, transactions: [tx('USD'), tx('GBP')] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.currencies).toEqual(['GBP', 'USD']);
  });

  it('allows a single consistent currency across all inputs', () => {
    const result = assembleForecastInput({
      ...base,
      income: [income({ currency: 'EUR' })],
      balances: [balance({ currency: 'EUR' })],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.currency).toBe('EUR');
  });
});
