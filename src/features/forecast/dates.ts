/**
 * Date-only arithmetic for forecasting.
 *
 * A "date key" is a `YYYY-MM-DD` string. Zero-padded keys sort lexicographically
 * in chronological order, which is why `compareKeys` is a plain string compare.
 *
 * All day math goes through a UTC ordinal (whole days since the epoch) so it is
 * completely free of timezone and daylight-saving drift — a forecast must be
 * identical on every device. Crucially, we only ever CONSTRUCT the ordinal from
 * explicit calendar parts (never from a wall-clock instant), so no local offset
 * ever leaks in.
 *
 * Parsing (`dateKeyFromISO`) mirrors how the rest of the app reads transaction
 * dates: a bare `YYYY-MM-DD` is treated as that calendar day as-is (never shifted
 * by a UTC parse), while a full ISO timestamp is reduced to its LOCAL calendar
 * day — matching `analytics.ts` / `detection.ts`, so a forecast buckets a
 * transaction on the same day the app displays it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/** Local calendar day of a `Date` as a `YYYY-MM-DD` key. */
export function toDateKey(date: Date): string {
  return `${pad4(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Parse an ISO date (date-only or full timestamp) to a date key.
 * - `YYYY-MM-DD` → returned as-is (no UTC shift).
 * - full timestamp → its LOCAL calendar day (matches app display).
 */
export function dateKeyFromISO(value: string): string {
  const trimmed = value.trim();
  const m = DATE_ONLY.exec(trimmed);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return toDateKey(d);
}

function parts(key: string): [number, number, number] {
  const m = DATE_ONLY.exec(key);
  if (!m) throw new Error(`Invalid date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Whole days since the epoch for a key, built purely from its calendar parts. */
export function ordinal(key: string): number {
  const [y, mo, d] = parts(key);
  return Math.round(Date.UTC(y, mo - 1, d) / DAY_MS);
}

/** Inverse of `ordinal`. */
export function keyFromOrdinal(ord: number): string {
  const d = new Date(ord * DAY_MS);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Chronological comparison of two keys (−1 / 0 / 1). */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Shift a key by whole days (may be negative). Rolls across months/years/leaps. */
export function addDays(key: string, days: number): string {
  return keyFromOrdinal(ordinal(key) + days);
}

/** Last day-of-month (1-based month), correct for leap Februaries. */
export function lastDayOfMonth(year: number, month1: number): number {
  // Date.UTC treats the 2nd arg as a 0-based month index, so `month1` lands on
  // the following month; day 0 of that month is the last day of `month1`.
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Add whole months to a (year, month) while applying an INTENDED day-of-month,
 * clamped to the target month's length. This is what preserves "always the 31st"
 * intent: Jan 31 → Feb 28/29 → Mar 31, computed from the original 31 each time
 * rather than from the previous clamped result.
 */
export function addMonthsPreservingDay(
  baseYear: number,
  baseMonth1: number,
  months: number,
  intendedDay: number
): string {
  const index = baseYear * 12 + (baseMonth1 - 1) + months;
  const year = Math.floor(index / 12);
  const month0 = index % 12;
  const day = Math.min(intendedDay, lastDayOfMonth(year, month0 + 1));
  return `${pad4(year)}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/** Inclusive day count between two keys (`a..b`). Negative when `b` precedes `a`. */
export function daysInclusive(startKey: string, endKey: string): number {
  return ordinal(endKey) - ordinal(startKey) + 1;
}

/** Every date key from `startKey` to `endKey` inclusive (empty when end < start). */
export function eachDay(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  const end = ordinal(endKey);
  for (let o = ordinal(startKey); o <= end; o += 1) out.push(keyFromOrdinal(o));
  return out;
}
