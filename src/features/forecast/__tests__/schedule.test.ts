/// <reference types="jest" />
import { generateIncomeEvents, generateRecurringEvents } from '@/features/forecast/schedule';
import type { ForecastIncomeSource } from '@/features/forecast/types';
import type { RecurringExpense } from '@/types/recurring';

const FROM = '2026-01-15'; // exclusive (the asOf day)
const TO = '2026-03-15'; // inclusive

const income = (
  schedule: ForecastIncomeSource['schedule'],
  amountCents = 100000
): ForecastIncomeSource => ({
  id: 'i1',
  label: 'Pay',
  amountCents,
  schedule,
});

const datesOf = (events: { date: string }[]) => events.map((e) => e.date);

/* -------------------------------------------------------------------------- */
/* Income                                                                     */
/* -------------------------------------------------------------------------- */

describe('generateIncomeEvents', () => {
  it('weekly rolls a past anchor forward into the window', () => {
    const events = generateIncomeEvents([income({ kind: 'weekly', anchorDate: '2026-01-10' })], FROM, TO);
    expect(datesOf(events)).toEqual([
      '2026-01-17',
      '2026-01-24',
      '2026-01-31',
      '2026-02-07',
      '2026-02-14',
      '2026-02-21',
      '2026-02-28',
      '2026-03-07',
      '2026-03-14',
    ]);
    expect(events[0]).toMatchObject({
      amountCents: 100000,
      direction: 'income',
      basis: 'scheduled',
      source: 'declared-income',
      label: 'Pay',
    });
  });

  it('biweekly steps by 14 days', () => {
    const events = generateIncomeEvents([income({ kind: 'biweekly', anchorDate: '2026-01-01' })], FROM, TO);
    expect(datesOf(events)).toEqual(['2026-01-29', '2026-02-12', '2026-02-26', '2026-03-12']);
  });

  it('monthly on the 31st clamps short months', () => {
    const events = generateIncomeEvents([income({ kind: 'monthly', dayOfMonth: 31 })], FROM, TO);
    expect(datesOf(events)).toEqual(['2026-01-31', '2026-02-28']); // Mar 31 is past the window
  });

  it('monthly is left-exclusive on asOf and right-inclusive on the horizon', () => {
    const events = generateIncomeEvents([income({ kind: 'monthly', dayOfMonth: 15 })], FROM, TO);
    expect(datesOf(events)).toEqual(['2026-02-15', '2026-03-15']); // Jan 15 == asOf, excluded
  });

  it('one-time fires only inside the window', () => {
    expect(datesOf(generateIncomeEvents([income({ kind: 'one-time', date: '2026-02-10' })], FROM, TO))).toEqual([
      '2026-02-10',
    ]);
    expect(generateIncomeEvents([income({ kind: 'one-time', date: '2026-01-15' })], FROM, TO)).toEqual([]);
    expect(generateIncomeEvents([income({ kind: 'one-time', date: '2026-04-01' })], FROM, TO)).toEqual([]);
  });

  it('custom keeps only in-window dates', () => {
    const events = generateIncomeEvents(
      [income({ kind: 'custom', dates: ['2026-01-20', '2026-03-15', '2026-05-01', '2026-01-15'] })],
      FROM,
      TO
    );
    expect(datesOf(events)).toEqual(['2026-01-20', '2026-03-15']);
  });

  it('ignores non-positive amounts', () => {
    expect(generateIncomeEvents([income({ kind: 'monthly', dayOfMonth: 1 }, 0)], FROM, TO)).toEqual([]);
    expect(generateIncomeEvents([income({ kind: 'monthly', dayOfMonth: 1 }, -500)], FROM, TO)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Recurring expenses                                                         */
/* -------------------------------------------------------------------------- */

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

describe('generateRecurringEvents', () => {
  it('schedules monthly occurrences as negative outflows', () => {
    const events = generateRecurringEvents(
      [rec({ merchant: 'Rent', expectedAmount: 1200, frequency: 'monthly', nextExpectedDate: '2026-02-01' })],
      FROM,
      TO
    );
    expect(datesOf(events)).toEqual(['2026-02-01', '2026-03-01']);
    expect(events[0]).toMatchObject({
      amountCents: -120000,
      direction: 'expense',
      basis: 'scheduled',
      source: 'confirmed-recurring',
      label: 'Rent',
    });
  });

  it('schedules weekly occurrences', () => {
    const events = generateRecurringEvents(
      [rec({ expectedAmount: 10, frequency: 'weekly', nextExpectedDate: '2026-01-12' })],
      FROM,
      TO
    );
    expect(datesOf(events)).toEqual([
      '2026-01-19',
      '2026-01-26',
      '2026-02-02',
      '2026-02-09',
      '2026-02-16',
      '2026-02-23',
      '2026-03-02',
      '2026-03-09',
    ]);
  });

  it('schedules quarterly and yearly from the anchor day', () => {
    expect(
      datesOf(
        generateRecurringEvents(
          [rec({ frequency: 'quarterly', nextExpectedDate: '2026-01-20', expectedAmount: 30 })],
          FROM,
          TO
        )
      )
    ).toEqual(['2026-01-20']); // next is April, past the window

    expect(
      datesOf(
        generateRecurringEvents(
          [rec({ frequency: 'yearly', nextExpectedDate: '2026-02-28', expectedAmount: 99 })],
          FROM,
          TO
        )
      )
    ).toEqual(['2026-02-28']);
  });

  it('rolls a stale (past) next date forward but still projects it', () => {
    const events = generateRecurringEvents(
      [rec({ frequency: 'monthly', nextExpectedDate: '2025-11-01', expectedAmount: 100 })],
      FROM,
      TO
    );
    expect(datesOf(events)).toEqual(['2026-02-01', '2026-03-01']);
  });

  it('excludes possible / ignored patterns and incomplete rows', () => {
    const events = generateRecurringEvents(
      [
        rec({ status: 'ignored', nextExpectedDate: '2026-02-05' }),
        rec({ status: 'possible', nextExpectedDate: '2026-02-06' }),
        rec({ status: 'confirmed', expectedAmount: null, nextExpectedDate: '2026-02-07' }),
        rec({ status: 'confirmed', nextExpectedDate: null }),
      ],
      FROM,
      TO
    );
    expect(events).toEqual([]);
  });
});
