/// <reference types="jest" />
import { assembleForecastInput } from '@/features/forecast/assemble';
import { buildForecast } from '@/features/forecast/forecast';
import { DemoStore } from '@/features/demo/demo-store';
import type { ForecastResult } from '@/features/forecast/types';

// The whole flow runs against the in-memory DemoStore — no Supabase, no network,
// no AsyncStorage — proving demo isolation while exercising the real engine.
const REF = new Date(2026, 5, 26, 12, 0, 0);
const HORIZON = { kind: 'days', days: 30 } as const;

async function forecastFrom(store: DemoStore): Promise<ForecastResult> {
  const [transactions, recurring, income, balances] = await Promise.all([
    store.fetchTransactions(),
    store.fetchRecurringExpenses(),
    store.fetchIncomeSources(),
    store.fetchBalanceSnapshots(),
  ]);
  const assembled = assembleForecastInput({ transactions, recurring, income, balances, asOf: REF, horizon: HORIZON });
  if (!assembled.ok) throw new Error('demo data should assemble into a single currency');
  return buildForecast(assembled.input);
}

describe('forecast over demo data', () => {
  it('projects a real balance from the seeded demo income + balance', async () => {
    const store = new DemoStore(REF);
    const forecast = await forecastFrom(store);
    expect(forecast.projectedBalanceCents).not.toBeNull(); // demo seeds a declared balance
    expect(forecast.events.some((e) => e.source === 'declared-income')).toBe(true);
  });

  it('recalculates when income is deactivated, and reset restores it', async () => {
    const store = new DemoStore(REF);
    const before = await forecastFrom(store);

    const paycheck = (await store.fetchIncomeSources()).find((i) => i.name === 'Paycheck');
    expect(paycheck).toBeDefined();
    await store.updateIncomeSource({ id: paycheck!.id, active: false });

    const after = await forecastFrom(store);
    // Removing an income source can only lower (or equal) net cash flow; here the
    // biweekly paycheck falls inside the window, so it strictly drops.
    expect(after.netChangeCents).toBeLessThan(before.netChangeCents);
    expect(after.events.some((e) => e.label === 'Paycheck')).toBe(false);

    store.reset();
    const restored = await forecastFrom(store);
    expect(restored.netChangeCents).toBe(before.netChangeCents);
  });

  it('reflects a balance edit immediately in the projected balance', async () => {
    const store = new DemoStore(REF);
    const before = await forecastFrom(store);

    // A same-day (as-of REF) snapshot is a current declared balance, so the
    // projection is exactly the new balance plus the (unchanged) forward net change.
    await store.upsertBalanceSnapshot({ amountCents: 1000000, effectiveDate: '2026-06-26', currency: 'USD' });
    const after = await forecastFrom(store);

    expect(after.netChangeCents).toBe(before.netChangeCents);
    expect(after.balanceBasis).toBe('declared');
    expect(after.projectedBalanceCents).toBe(1000000 + after.netChangeCents);
  });
});

/**
 * Logic-level E2E of the critical journey, run through the REAL demo repository
 * + forecast engine (no backend, no device). Mirrors `.maestro/forecast-journey`:
 * Explore demo → view forecast → add income → enter balance → modify income →
 * inspect change → reset.
 */
describe('critical journey (demo, logic-level E2E)', () => {
  it('walks add-income → balance → modify → reset with a coherent forecast throughout', async () => {
    const store = new DemoStore(REF); // "Explore demo"

    const start = await forecastFrom(store); // "View forecast"
    expect(start.projectedBalanceCents).not.toBeNull();

    // "Add income": a monthly source landing inside the 30-day window.
    await store.createIncomeSource({
      name: 'Signing bonus',
      amountCents: 150000,
      frequency: 'monthly',
      startDate: '2026-06-28',
      dayOfMonth: 28,
    });
    const withIncome = await forecastFrom(store);
    expect(withIncome.netChangeCents).toBeGreaterThan(start.netChangeCents); // income lifts net
    expect(withIncome.events.some((e) => e.label === 'Signing bonus')).toBe(true);

    // "Enter balance": a current, same-day declared balance.
    await store.upsertBalanceSnapshot({ amountCents: 800000, effectiveDate: '2026-06-26', currency: 'USD' });
    const withBalance = await forecastFrom(store);
    expect(withBalance.balanceBasis).toBe('declared');
    expect(withBalance.projectedBalanceCents).toBe(800000 + withBalance.netChangeCents);

    // "Modify income": deactivate the new source.
    const bonus = (await store.fetchIncomeSources()).find((i) => i.name === 'Signing bonus');
    expect(bonus).toBeDefined();
    await store.updateIncomeSource({ id: bonus!.id, active: false });
    const modified = await forecastFrom(store);
    expect(modified.netChangeCents).toBeLessThan(withIncome.netChangeCents); // "Inspect change"
    expect(modified.events.some((e) => e.label === 'Signing bonus')).toBe(false);

    // "Reset demo": original dataset restored.
    store.reset();
    const reset = await forecastFrom(store);
    expect(reset.netChangeCents).toBe(start.netChangeCents);
    expect((await store.fetchIncomeSources()).some((i) => i.name === 'Signing bonus')).toBe(false);
  });
});
