/**
 * Month helpers. A "month key" is `YYYY-MM`; the database stores the first day
 * of the month (`YYYY-MM-01`). All budget logic is keyed by month so different
 * months never overwrite each other.
 */

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

/** `YYYY-MM` for a given date (defaults to now). */
export function monthKeyFromDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyFromDate(now);
}

/** `YYYY-MM` → the first-day date string the DB stores (`YYYY-MM-01`). */
export function monthStartISO(monthKey: string): string {
  return `${monthKey}-01`;
}

/** A stored `YYYY-MM-DD` date (or `YYYY-MM`) → its month key `YYYY-MM`. */
export function monthKeyFromStored(value: string): string {
  return value.slice(0, 7);
}

/** `YYYY-MM` → "September 2026". */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return monthLabelFormatter.format(new Date(year, month - 1, 1));
}

/** The month key immediately before the given one. */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 2, 1); // month is 1-based; -2 → previous month
  return monthKeyFromDate(date);
}

/** The month key immediately after the given one. */
export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month, 1); // month is 1-based; passing `month` (0-based) → next month
  return monthKeyFromDate(date);
}

/** Number of days in a given month key (`YYYY-MM`). */
export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate(); // day 0 of the next month → last day of this one
}

/** Whether the month key is the month `now` falls in. */
export function isCurrentMonth(monthKey: string, now: Date = new Date()): boolean {
  return monthKey === currentMonthKey(now);
}

/**
 * Whether the month key is after the current month. `YYYY-MM` keys sort
 * lexicographically, so a plain string compare is correct.
 */
export function isFutureMonth(monthKey: string, now: Date = new Date()): boolean {
  return monthKey > currentMonthKey(now);
}
