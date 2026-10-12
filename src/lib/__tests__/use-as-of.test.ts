/// <reference types="jest" />
import { msUntilNextLocalMidnight, nextAsOf, sameLocalDay } from '@/lib/use-as-of';

describe('sameLocalDay', () => {
  it('ignores the time of day', () => {
    expect(sameLocalDay(new Date(2026, 0, 15, 1, 0), new Date(2026, 0, 15, 23, 59))).toBe(true);
  });

  it('distinguishes different days', () => {
    expect(sameLocalDay(new Date(2026, 0, 15, 23, 59), new Date(2026, 0, 16, 0, 1))).toBe(false);
  });
});

describe('nextAsOf', () => {
  it('keeps the previous Date identity within the same day (no churn)', () => {
    const prev = new Date(2026, 0, 15, 9, 0);
    const candidate = new Date(2026, 0, 15, 17, 30);
    expect(nextAsOf(prev, candidate)).toBe(prev); // same reference
  });

  it('adopts the candidate once the day rolls over', () => {
    const prev = new Date(2026, 0, 15, 23, 0);
    const candidate = new Date(2026, 0, 16, 0, 5);
    expect(nextAsOf(prev, candidate)).toBe(candidate);
  });
});

describe('msUntilNextLocalMidnight', () => {
  it('counts the time to just after the next midnight', () => {
    // 22:00 → 00:00:02 next day = 2h + 2s.
    expect(msUntilNextLocalMidnight(new Date(2026, 0, 15, 22, 0, 0))).toBe(2 * 3600_000 + 2000);
  });

  it('is always a positive, bounded interval', () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 5, 1, 0, 0, 1));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 3600_000 + 2000);
  });
});
