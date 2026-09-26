/// <reference types="jest" />
import {
  currentMonthKey,
  monthKeyFromDate,
  monthKeyFromStored,
  monthLabel,
  monthStartISO,
  previousMonthKey,
} from '@/lib/month';

describe('month helpers', () => {
  it('derives a month key from a date', () => {
    expect(monthKeyFromDate(new Date(2026, 8, 24))).toBe('2026-09');
    expect(monthKeyFromDate(new Date(2026, 0, 1))).toBe('2026-01');
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('normalizes to the first day of the month for storage', () => {
    expect(monthStartISO('2026-09')).toBe('2026-09-01');
  });

  it('extracts a month key from a stored date', () => {
    expect(monthKeyFromStored('2026-09-01')).toBe('2026-09');
  });

  it('formats a human label', () => {
    expect(monthLabel('2026-09')).toBe('September 2026');
  });

  it('walks to the previous month across year boundaries', () => {
    expect(previousMonthKey('2026-09')).toBe('2026-08');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });
});
