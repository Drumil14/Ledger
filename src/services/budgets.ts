import { SESSION_EXPIRED } from '@/lib/errors';
import { monthStartISO } from '@/lib/month';
import { supabase } from '@/lib/supabase';
import type { Budget } from '@/types/transaction';

type BudgetRow = {
  id: string;
  user_id: string;
  month: string;
  limit_amount: number | string;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type UpsertBudgetInput = {
  /** `YYYY-MM`. */
  monthKey: string;
  limit: number;
  currency?: string;
};

const TABLE = 'budgets';

function mapRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    month: row.month,
    limit: typeof row.limit_amount === 'string' ? Number(row.limit_amount) : row.limit_amount,
    currency: row.currency,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(SESSION_EXPIRED);
  return data.user.id;
}

/** The budget for a single month (`YYYY-MM`), or null if none exists. */
export async function fetchBudget(monthKey: string): Promise<Budget | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('month', monthStartISO(monthKey))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data as BudgetRow) : null;
}

/** All budgets, newest month first (history). */
export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('month', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as BudgetRow[]).map(mapRow);
}

/** Create or replace the budget for a month (unique per user+month). */
export async function upsertBudget(input: UpsertBudgetInput): Promise<Budget> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        month: monthStartISO(input.monthKey),
        limit_amount: input.limit,
        currency: input.currency ?? 'USD',
      },
      { onConflict: 'user_id,month' }
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as BudgetRow);
}

export async function deleteBudget(monthKey: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('month', monthStartISO(monthKey));
  if (error) throw new Error(error.message);
}
