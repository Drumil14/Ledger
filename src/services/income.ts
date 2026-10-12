import { SESSION_EXPIRED } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { IncomeFrequency, IncomeSchedule, IncomeSource } from '@/types/income';

/** Shape of a row as stored in Postgres (snake_case). */
type IncomeRow = {
  id: string;
  user_id: string;
  name: string;
  amount_cents: number | string;
  currency: string;
  frequency: IncomeFrequency;
  day_of_month: number | null;
  custom_dates: string[] | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Mirrors the table columns; the engine `schedule` is reconstructed on read. */
export type CreateIncomeInput = {
  name: string;
  amountCents: number;
  currency?: string;
  frequency: IncomeFrequency;
  /** ISO `YYYY-MM-DD`; anchor for weekly/biweekly, the date for one-time. */
  startDate: string;
  endDate?: string | null;
  /** Required when `frequency` is `monthly` (1–31). */
  dayOfMonth?: number | null;
  /** Required when `frequency` is `custom` (ISO `YYYY-MM-DD` list). */
  customDates?: string[] | null;
  active?: boolean;
};

export type UpdateIncomeInput = { id: string } & Partial<CreateIncomeInput>;

const TABLE = 'income_sources';

/** Rebuild the engine-facing schedule union from the flat columns. */
function toSchedule(row: IncomeRow): IncomeSchedule {
  switch (row.frequency) {
    case 'weekly':
      return { kind: 'weekly', anchorDate: row.start_date };
    case 'biweekly':
      return { kind: 'biweekly', anchorDate: row.start_date };
    case 'monthly':
      return { kind: 'monthly', dayOfMonth: row.day_of_month ?? 1 };
    case 'one-time':
      return { kind: 'one-time', date: row.start_date };
    case 'custom':
      return { kind: 'custom', dates: row.custom_dates ?? [] };
  }
}

function mapRow(row: IncomeRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    // bigint can arrive as a string; Number keeps integer cents exact.
    amountCents: typeof row.amount_cents === 'string' ? Number(row.amount_cents) : row.amount_cents,
    currency: row.currency,
    schedule: toSchedule(row),
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.is_active,
  };
}

/** The current user's id from the active session (never trusted from the UI). */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(SESSION_EXPIRED);
  return data.user.id;
}

/** Map create/update fields to column values (undefined keys are omitted). */
function toColumns(input: Partial<CreateIncomeInput>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (input.name !== undefined) cols.name = input.name;
  if (input.amountCents !== undefined) cols.amount_cents = input.amountCents;
  if (input.currency !== undefined) cols.currency = input.currency;
  if (input.frequency !== undefined) cols.frequency = input.frequency;
  if (input.startDate !== undefined) cols.start_date = input.startDate;
  if (input.endDate !== undefined) cols.end_date = input.endDate ?? null;
  if (input.dayOfMonth !== undefined) cols.day_of_month = input.dayOfMonth ?? null;
  if (input.customDates !== undefined) cols.custom_dates = input.customDates ?? null;
  if (input.active !== undefined) cols.is_active = input.active;
  return cols;
}

export async function fetchIncomeSources(): Promise<IncomeSource[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as IncomeRow[]).map(mapRow);
}

export async function createIncomeSource(input: CreateIncomeInput): Promise<IncomeSource> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      currency: input.currency ?? 'USD',
      is_active: input.active ?? true,
      ...toColumns(input),
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as IncomeRow);
}

export async function updateIncomeSource(input: UpdateIncomeInput): Promise<IncomeSource> {
  const { id, ...rest } = input;
  const { data, error } = await supabase
    .from(TABLE)
    .update(toColumns(rest))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as IncomeRow);
}

export async function deleteIncomeSource(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
