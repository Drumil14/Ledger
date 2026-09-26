/**
 * Recurring-expense detection — pure, deterministic, and AI-free.
 *
 * Given a list of transactions this module groups them by a normalized merchant
 * key, then decides whether each group forms a recurring pattern based purely on
 * three signals from the history itself:
 *
 *   1. merchant normalization  — collapse "SPOTIFY", "Spotify USA", "SPOTIFY*1234"
 *   2. amount similarity        — subscription amounts must stay within a tolerance
 *   3. date intervals           — consecutive gaps must fit one frequency's band
 *
 * Nothing here calls a model, touches React/Supabase, or reads the system clock
 * (callers inject `now`). The same inputs always yield the same candidates, which
 * makes the whole engine exhaustively unit-testable.
 *
 * Money is compared in integer **cents** (via `@/lib/money`) so amount tolerance
 * never drifts on floats.
 */

import { amountToCents, centsToAmount } from '@/lib/money';
import type { Transaction } from '@/types/transaction';
import type { RecurringConfidence, RecurringFrequency } from '@/types/recurring';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Per-frequency expected interval and the accepted band (in whole days). Bands
 * are deliberately disjoint so any given gap maps to at most one frequency, and
 * `monthly` is wide enough to absorb natural calendar variation (28–31 days plus
 * a few days of billing slack) — we never require exactly 30 days.
 */
type FrequencyDef = {
  frequency: RecurringFrequency;
  /** Ideal gap in days (used for tie-breaking / next-date fallbacks). */
  targetDays: number;
  minDays: number;
  maxDays: number;
};

const FREQUENCY_DEFS: readonly FrequencyDef[] = [
  { frequency: 'weekly', targetDays: 7, minDays: 5, maxDays: 10 },
  { frequency: 'biweekly', targetDays: 14, minDays: 11, maxDays: 18 },
  { frequency: 'monthly', targetDays: 30, minDays: 24, maxDays: 38 },
  { frequency: 'quarterly', targetDays: 91, minDays: 75, maxDays: 105 },
  { frequency: 'yearly', targetDays: 365, minDays: 330, maxDays: 400 },
];

/** Default relative amount tolerance for subscriptions (±5%). */
export const DEFAULT_AMOUNT_TOLERANCE = 0.05;

/** Never flag anything with fewer than two occurrences. */
const MIN_OCCURRENCES = 2;

export type DetectionOptions = {
  /** Fixed "now" for confidence/recency decisions. Defaults to `new Date()`. */
  now?: Date;
  /** Relative amount tolerance (fraction). Defaults to 5%. */
  amountTolerance?: number;
  /** Minimum matched transactions to surface a candidate. Defaults to 2. */
  minOccurrences?: number;
};

/* -------------------------------------------------------------------------- */
/* Result type                                                                */
/* -------------------------------------------------------------------------- */

export type RecurringCandidate = {
  /** Deterministic grouping key. */
  normalizedMerchant: string;
  /** Human-facing merchant name (raw string from the most recent match). */
  merchant: string;
  frequency: RecurringFrequency;
  /** Representative amount (median of matches), in dollars. */
  expectedAmount: number;
  /** How many transactions support the pattern. */
  occurrences: number;
  /** Derived purely from evidence — internal only, never shown as a score. */
  confidence: RecurringConfidence;
  /** Matched transaction ids, newest first. */
  transactionIds: string[];
  /** Earliest matched date (ISO 8601). */
  firstDate: string;
  /** Latest matched date (ISO 8601). */
  lastDate: string;
  /** Id of the latest matched transaction. */
  lastTransactionId: string;
  /** Estimated next charge date (ISO `YYYY-MM-DD`). */
  nextExpectedDate: string;
  /** Average consecutive gap in days (rounded). */
  averageIntervalDays: number;
};

/* -------------------------------------------------------------------------- */
/* Merchant normalization                                                     */
/* -------------------------------------------------------------------------- */

// Payment-processor / aggregator prefixes that carry no merchant identity.
const PROCESSOR_PREFIXES = [
  'sq *',
  'sq*',
  'tst* ',
  'tst*',
  'paypal *',
  'pp*',
  'pp *',
  'dd *',
  'dd*',
  'pos ',
  'pos*',
  'chk*',
];

// Trailing words that describe a plan / location rather than the merchant. Only
// stripped when they trail (and something identifying remains), so unrelated
// merchants like "Apple Music" vs "Apple TV" never collapse together.
const SUFFIX_STOPWORDS = new Set([
  'usa',
  'com',
  'inc',
  'llc',
  'ltd',
  'co',
  'corp',
  'subscription',
  'subscriptions',
  'recurring',
  'autopay',
  'membership',
  'premium',
]);

/**
 * Deterministically normalize a raw merchant string for matching. Conservative
 * by design: it strips processor noise, punctuation, store/txn numbers, and a
 * small set of trailing plan words — but never guesses at unrelated names.
 *
 *   "SPOTIFY"          → "spotify"
 *   "Spotify USA"      → "spotify"
 *   "Spotify Premium"  → "spotify"
 *   "SPOTIFY*1234"     → "spotify"
 */
export function normalizeMerchant(raw: string): string {
  let value = raw.toLowerCase().trim();

  for (const prefix of PROCESSOR_PREFIXES) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
      break;
    }
  }

  // `*` and `#` become separators; drop remaining punctuation but keep letters,
  // numbers, whitespace and `&` (e.g. "at&t").
  value = value.replace(/[*#]/g, ' ');
  value = value.replace(/[^\p{L}\p{N}\s&]/gu, ' ');

  let tokens = value.split(/\s+/).filter(Boolean);

  // Drop store / transaction numbers (pure-digit tokens of length ≥ 2). Short
  // single digits (e.g. the "7" in "7 eleven") are kept as they can be semantic.
  tokens = tokens.filter((t) => !/^\d{2,}$/.test(t));

  // Strip trailing plan / location words, but always keep at least one token.
  while (tokens.length > 1 && SUFFIX_STOPWORDS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(' ').trim();
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function dayDiff(fromISO: string, toISO: string): number {
  const diff = new Date(toISO).getTime() - new Date(fromISO).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** Median of a list of integers (cents), rounded for even-length lists. */
function medianCents(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function frequencyForInterval(days: number): RecurringFrequency | null {
  for (const def of FREQUENCY_DEFS) {
    if (days >= def.minDays && days <= def.maxDays) return def.frequency;
  }
  return null;
}

/**
 * Confidence from evidence alone: more consistent occurrences ⇒ higher. Tight
 * amount consistency nudges a borderline count upward. Deterministic; internal.
 */
function confidenceFor(occurrences: number, amountsTight: boolean): RecurringConfidence {
  if (occurrences >= 4) return 'high';
  if (occurrences === 3) return amountsTight ? 'high' : 'medium';
  // exactly 2
  return amountsTight ? 'medium' : 'low';
}

/**
 * Estimated next charge date from the last occurrence, advanced by one period.
 * Weekly/biweekly add days; monthly/quarterly/yearly advance by calendar months
 * so the day-of-month is preserved (clamped for short months). Returns `YYYY-MM-DD`.
 */
export function computeNextExpectedDate(
  lastDateISO: string,
  frequency: RecurringFrequency
): string {
  const next = parseToLocalDate(lastDateISO);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      advanceMonths(next, 1);
      break;
    case 'quarterly':
      advanceMonths(next, 3);
      break;
    case 'yearly':
      advanceMonths(next, 12);
      break;
  }

  return toDateKey(next);
}

/** Advance by whole months, clamping the day to the target month's length. */
function advanceMonths(date: Date, months: number): void {
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDayOfMonth));
}

/**
 * Parse either a date-only `YYYY-MM-DD` key (as local midnight, avoiding a UTC
 * off-by-one) or a full ISO timestamp (whose local calendar date matches how the
 * rest of the app renders transaction dates).
 */
function parseToLocalDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* -------------------------------------------------------------------------- */
/* Detection                                                                  */
/* -------------------------------------------------------------------------- */

type Group = { normalized: string; transactions: Transaction[] };

function groupByMerchant(transactions: Transaction[]): Group[] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = normalizeMerchant(t.merchant);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(t);
    else map.set(key, [t]);
  }
  return Array.from(map.entries()).map(([normalized, txs]) => ({ normalized, transactions: txs }));
}

/**
 * Evaluate a single merchant group. Returns a candidate only when every
 * consecutive interval maps to the *same* frequency band and all amounts sit
 * within tolerance of the median — otherwise the group is just unrelated spend.
 */
function evaluateGroup(group: Group, tolerance: number, minOccurrences: number): RecurringCandidate | null {
  const { normalized, transactions } = group;
  if (transactions.length < minOccurrences) return null;

  // Oldest → newest for interval math.
  const ordered = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Every consecutive gap must belong to one shared frequency band.
  const intervals: number[] = [];
  let frequency: RecurringFrequency | null = null;
  for (let i = 1; i < ordered.length; i += 1) {
    const gap = dayDiff(ordered[i - 1].date, ordered[i].date);
    const gapFreq = frequencyForInterval(gap);
    if (gapFreq === null) return null;
    if (frequency === null) frequency = gapFreq;
    else if (frequency !== gapFreq) return null;
    intervals.push(gap);
  }
  if (frequency === null) return null;

  // Amounts must be similar (subscriptions). Tolerance is relative to the median
  // with a 1-cent floor so tiny amounts aren't rejected by rounding.
  const amountsCents = ordered.map((t) => amountToCents(t.amount));
  const medCents = medianCents(amountsCents);
  const allowedDeviation = Math.max(1, Math.round(medCents * tolerance));
  const withinTolerance = amountsCents.every((c) => Math.abs(c - medCents) <= allowedDeviation);
  if (!withinTolerance) return null;

  // Tight ⇒ every amount is exactly the median (fixed subscription).
  const amountsTight = amountsCents.every((c) => c === medCents);

  const occurrences = ordered.length;
  const averageIntervalDays = Math.round(
    intervals.reduce((sum, d) => sum + d, 0) / intervals.length
  );

  const newestFirst = [...ordered].reverse();
  const last = newestFirst[0];

  return {
    normalizedMerchant: normalized,
    merchant: last.merchant,
    frequency,
    expectedAmount: centsToAmount(medCents),
    occurrences,
    confidence: confidenceFor(occurrences, amountsTight),
    transactionIds: newestFirst.map((t) => t.id),
    firstDate: ordered[0].date,
    lastDate: last.date,
    lastTransactionId: last.id,
    nextExpectedDate: computeNextExpectedDate(last.date, frequency),
    averageIntervalDays,
  };
}

/**
 * Detect recurring candidates across a transaction list. Results are sorted by
 * evidence strength then amount so the strongest patterns surface first; the
 * order is stable for identical inputs.
 */
export function detectRecurring(
  transactions: Transaction[],
  options: DetectionOptions = {}
): RecurringCandidate[] {
  const tolerance = options.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const minOccurrences = Math.max(MIN_OCCURRENCES, options.minOccurrences ?? MIN_OCCURRENCES);

  const candidates: RecurringCandidate[] = [];
  for (const group of groupByMerchant(transactions)) {
    const candidate = evaluateGroup(group, tolerance, minOccurrences);
    if (candidate) candidates.push(candidate);
  }

  const confidenceRank: Record<RecurringConfidence, number> = { high: 0, medium: 1, low: 2 };
  return candidates.sort(
    (a, b) =>
      confidenceRank[a.confidence] - confidenceRank[b.confidence] ||
      amountToCents(b.expectedAmount) - amountToCents(a.expectedAmount) ||
      a.normalizedMerchant.localeCompare(b.normalizedMerchant)
  );
}

/**
 * All transactions belonging to a normalized merchant whose amount sits within
 * tolerance of `expectedAmount`, newest first. Used to show the matching history
 * behind a confirmed recurring expense without re-running full detection.
 */
export function matchingTransactions(
  transactions: Transaction[],
  normalizedMerchant: string,
  expectedAmount: number | null,
  tolerance = DEFAULT_AMOUNT_TOLERANCE
): Transaction[] {
  const targetCents = expectedAmount !== null ? amountToCents(expectedAmount) : null;
  const allowed = targetCents !== null ? Math.max(1, Math.round(targetCents * tolerance)) : null;

  return transactions
    .filter((t) => normalizeMerchant(t.merchant) === normalizedMerchant)
    .filter((t) => {
      if (targetCents === null || allowed === null) return true;
      return Math.abs(amountToCents(t.amount) - targetCents) <= allowed;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
