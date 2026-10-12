/// <reference types="jest" />
import {
  addDays,
  addMonthsPreservingDay,
  compareKeys,
  dateKeyFromISO,
  daysInclusive,
  eachDay,
  keyFromOrdinal,
  lastDayOfMonth,
  ordinal,
  toDateKey,
} from '@/features/forecast/dates';

describe('toDateKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('dateKeyFromISO', () => {
  it('returns a bare date string unchanged (no UTC shift)', () => {
    expect(dateKeyFromISO('2026-01-05')).toBe('2026-01-05');
    expect(dateKeyFromISO('  2026-02-28 ')).toBe('2026-02-28');
  });

  it('reduces a local timestamp to its calendar day', () => {
    expect(dateKeyFromISO('2026-02-28T12:30:00')).toBe('2026-02-28');
  });

  it('throws on garbage', () => {
    expect(() => dateKeyFromISO('not-a-date')).toThrow();
  });
});

describe('addDays', () => {
  it('rolls across a year boundary', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('respects February length in common and leap years', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('lastDayOfMonth', () => {
  it('knows month lengths including leap February', () => {
    expect(lastDayOfMonth(2026, 1)).toBe(31);
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
});

describe('addMonthsPreservingDay', () => {
  it('preserves the 31st intent, clamping per month', () => {
    expect(addMonthsPreservingDay(2026, 1, 1, 31)).toBe('2026-02-28'); // Jan 31 -> Feb 28
    expect(addMonthsPreservingDay(2028, 1, 1, 31)).toBe('2028-02-29'); // leap Feb
    expect(addMonthsPreservingDay(2026, 1, 2, 31)).toBe('2026-03-31'); // back to 31 in March
  });

  it('crosses year boundaries', () => {
    expect(addMonthsPreservingDay(2026, 12, 1, 15)).toBe('2027-01-15');
    expect(addMonthsPreservingDay(2028, 2, 12, 29)).toBe('2029-02-28'); // yearly from Feb 29
  });
});

describe('daysInclusive', () => {
  it('counts both endpoints', () => {
    expect(daysInclusive('2026-01-01', '2026-01-31')).toBe(31);
    expect(daysInclusive('2026-02-01', '2026-03-01')).toBe(29); // 28 Feb days + Mar 1
    expect(daysInclusive('2026-01-10', '2026-01-10')).toBe(1);
  });
});

describe('eachDay', () => {
  it('enumerates inclusively across a month boundary', () => {
    expect(eachDay('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('is empty when end precedes start', () => {
    expect(eachDay('2026-02-02', '2026-02-01')).toEqual([]);
  });
});

describe('compareKeys / ordinal', () => {
  it('orders chronologically', () => {
    expect(compareKeys('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareKeys('2026-02-01', '2026-01-31')).toBe(1);
    expect(compareKeys('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('round-trips through an ordinal', () => {
    for (const key of ['2024-02-29', '2026-01-01', '2026-12-31', '2030-07-15']) {
      expect(keyFromOrdinal(ordinal(key))).toBe(key);
    }
  });
});
