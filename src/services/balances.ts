import { SESSION_EXPIRED } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { BalanceSnapshot } from '@/types/income';

type BalanceRow = {
  id: string;
  user_id: string;
  amount_cents: number | string;
  currency: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
};

export type UpsertBalanceInput = {
  amountCents: number;
  currency?: string;
  /** ISO `YYYY-MM-DD` the balance was accurate as of. */
  effectiveDate: string;
};

const TABLE = 'balance_snapshots';

function mapRow(row: BalanceRow): BalanceSnapshot {
  return {
    id: row.id,
    amountCents: typeof row.amount_cents === 'string' ? Number(row.amount_cents) : row.amount_cents,
    currency: row.currency,
    effectiveDate: row.effective_date,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(SESSION_EXPIRED);
  return data.user.id;
}

/** All of the user's balance snapshots, newest effective date first. */
export async function fetchBalanceSnapshots(): Promise<BalanceSnapshot[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('effective_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as BalanceRow[]).map(mapRow);
}

/**
 * Create or replace the snapshot for a given effective date (unique per
 * user + date). A balance is always explicitly declared by the user.
 */
export async function upsertBalanceSnapshot(input: UpsertBalanceInput): Promise<BalanceSnapshot> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        amount_cents: input.amountCents,
        currency: input.currency ?? 'USD',
        effective_date: input.effectiveDate,
      },
      { onConflict: 'user_id,effective_date' }
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as BalanceRow);
}

export async function deleteBalanceSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
