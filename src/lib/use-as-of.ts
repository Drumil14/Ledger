/**
 * A coherent "as of now" date for date-sensitive screens (forecast, insights).
 *
 * `new Date()` captured once in a `useMemo([])` goes stale: if the screen stays
 * mounted across local midnight, is backgrounded for hours, or is a long-lived
 * tab, the forecast keeps projecting from yesterday. This hook returns a Date
 * whose *identity* only changes when the local calendar day changes — so derived
 * `useMemo`s stay stable within a day (no churn) but advance correctly when the
 * day rolls over, the app returns to the foreground, or the screen regains focus.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Whether two dates fall on the same local calendar day. */
export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The next `asOf` value: keep the previous Date (stable identity) while still the
 * same local day, otherwise adopt the candidate. Pure — the testable core of the
 * hook's refresh logic.
 */
export function nextAsOf(prev: Date, candidate: Date): Date {
  return sameLocalDay(prev, candidate) ? prev : candidate;
}

/** Milliseconds from `from` until just after the next local midnight. */
export function msUntilNextLocalMidnight(from: Date): number {
  const nextMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 0, 0, 2);
  return Math.max(1000, nextMidnight.getTime() - from.getTime());
}

export function useAsOf(): Date {
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(() => {
    setNow((prev) => nextAsOf(prev, new Date()));
  }, []);

  // Advance when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Advance when the screen regains focus (returning from a pushed modal).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Advance shortly after the next local midnight; re-arm whenever `now` changes.
  useEffect(() => {
    const timer = setTimeout(refresh, msUntilNextLocalMidnight(new Date()));
    return () => clearTimeout(timer);
  }, [now, refresh]);

  return now;
}
