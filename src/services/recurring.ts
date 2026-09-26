import { SESSION_EXPIRED } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type {
  RecurringExpense,
  RecurringFrequency,
  RecurringSource,
  RecurringStatus,
} from '@/types/recurring';

/** Shape of a row as stored in Postgres (snake_case). */
type RecurringRow = {
  id: string;
  user_id: string;
  merchant: string;
  normalized_merchant: string;
  expected_amount: number | string | null;
  frequency: RecurringFrequency;
  next_expected_date: string | null;
  status: RecurringStatus;
  source: RecurringSource;
  last_transaction_id: string | null;
  last_detected_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Everything needed to persist a confirm/ignore decision for a pattern. */
export type UpsertRecurringInput = {
  merchant: string;
  normalizedMerchant: string;
  expectedAmount: number | null;
  frequency: RecurringFrequency;
  nextExpectedDate?: string | null;
  lastTransactionId?: string | null;
};

const TABLE = 'recurring_expenses';

function mapRow(row: RecurringRow): RecurringExpense {
  const expected =
    row.expected_amount === null
      ? null
      : typeof row.expected_amount === 'string'
        ? Number(row.expected_amount)
        : row.expected_amount;

  return {
    id: row.id,
    merchant: row.merchant,
    normalizedMerchant: row.normalized_merchant,
    expectedAmount: expected,
    frequency: row.frequency,
    nextExpectedDate: row.next_expected_date,
    status: row.status,
    source: row.source,
    lastTransactionId: row.last_transaction_id ?? undefined,
    lastDetectedAt: row.last_detected_at ?? undefined,
  };
}

/** The current user's id from the active session (never trusted from the UI). */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(SESSION_EXPIRED);
  return data.user.id;
}

/** All of the user's recurring-expense decisions. */
export async function fetchRecurringExpenses(): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('expected_amount', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as RecurringRow[]).map(mapRow);
}

/**
 * Persist a decision for a pattern. Upserts on (user_id, normalized_merchant,
 * frequency) so confirming/ignoring the same pattern twice never duplicates a
 * row and cleanly flips status.
 */
async function upsertDecision(
  input: UpsertRecurringInput,
  status: RecurringStatus
): Promise<RecurringExpense> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        merchant: input.merchant,
        normalized_merchant: input.normalizedMerchant,
        expected_amount: input.expectedAmount,
        frequency: input.frequency,
        next_expected_date: input.nextExpectedDate ?? null,
        status,
        source: 'detected',
        last_transaction_id: input.lastTransactionId ?? null,
        last_detected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,normalized_merchant,frequency' }
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as RecurringRow);
}

/** Confirm a detected candidate as a recurring expense. */
export function confirmRecurring(input: UpsertRecurringInput): Promise<RecurringExpense> {
  return upsertDecision(input, 'confirmed');
}

/** Mark a candidate as not recurring so it isn't surfaced again. */
export function ignoreRecurring(input: UpsertRecurringInput): Promise<RecurringExpense> {
  return upsertDecision(input, 'ignored');
}

/** Delete a recurring-expense record (e.g. remove a confirmed subscription). */
export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
