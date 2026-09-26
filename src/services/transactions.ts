import { SESSION_EXPIRED } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { ReceiptLineItem, SourceType, Transaction } from '@/types/transaction';

/** Shape of a row as stored in Postgres (snake_case). */
type TransactionRow = {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  merchant: string;
  category: string;
  transaction_date: string;
  note: string | null;
  source_type: SourceType;
  receipt_path: string | null;
  receipt_items: ReceiptLineItem[] | null;
  created_at: string;
  updated_at: string;
};

export type CreateTransactionInput = {
  amount: number;
  currency?: string;
  merchant: string;
  category: string;
  /** ISO 8601 timestamp. */
  date: string;
  note?: string;
  sourceType?: SourceType;
  receiptPath?: string;
  receiptItems?: ReceiptLineItem[];
};

export type UpdateTransactionInput = {
  id: string;
} & Partial<Omit<CreateTransactionInput, 'sourceType'>>;

const TABLE = 'transactions';

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    // numeric can arrive as string; Number() keeps it exact for 2-dp values.
    amount: typeof row.amount === 'string' ? Number(row.amount) : row.amount,
    currency: row.currency,
    merchant: row.merchant,
    category: row.category,
    date: row.transaction_date,
    note: row.note ?? undefined,
    sourceType: row.source_type,
    receiptPath: row.receipt_path ?? undefined,
    receiptItems: row.receipt_items ?? undefined,
  };
}

/** The current user's id from the active session (never trusted from the client UI). */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error(SESSION_EXPIRED);
  }
  return data.user.id;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('transaction_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as TransactionRow[]).map(mapRow);
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      amount: input.amount,
      currency: input.currency ?? 'USD',
      merchant: input.merchant,
      category: input.category,
      transaction_date: input.date,
      note: input.note ?? null,
      source_type: input.sourceType ?? 'manual',
      receipt_path: input.receiptPath ?? null,
      receipt_items: input.receiptItems ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as TransactionRow);
}

export async function updateTransaction(input: UpdateTransactionInput): Promise<Transaction> {
  const { id, date, ...rest } = input;

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...(rest.amount !== undefined ? { amount: rest.amount } : {}),
      ...(rest.currency !== undefined ? { currency: rest.currency } : {}),
      ...(rest.merchant !== undefined ? { merchant: rest.merchant } : {}),
      ...(rest.category !== undefined ? { category: rest.category } : {}),
      ...(date !== undefined ? { transaction_date: date } : {}),
      ...(rest.note !== undefined ? { note: rest.note ?? null } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as TransactionRow);
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
