-- Ledger — recurring expenses / subscription detection.
-- Stores a user's *decisions* about recurring patterns (confirmed / ignored).
-- Candidate detection itself is deterministic and computed client-side from
-- transaction history (see src/features/recurring/detection.ts); this table only
-- persists what the user has decided, so a confirmed or ignored pattern is never
-- surfaced again as a fresh candidate.
-- Apply after 0003_budgets.sql (SQL editor or `supabase db push`).

-- 1. Table -------------------------------------------------------------------

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Display merchant (the raw string from a representative transaction).
  merchant text not null check (char_length(merchant) between 1 and 120),
  -- Deterministically normalized merchant used for matching / de-duplication.
  normalized_merchant text not null check (char_length(normalized_merchant) between 1 and 120),
  -- Representative amount for the pattern (median of matched transactions).
  expected_amount numeric(12, 2),
  frequency text not null
    check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_expected_date date,
  status text not null default 'possible'
    check (status in ('possible', 'confirmed', 'ignored')),
  source text not null default 'detected'
    check (source in ('detected', 'manual')),
  -- Optional bookkeeping to help avoid duplicate detection noise.
  last_transaction_id uuid references public.transactions (id) on delete set null,
  last_detected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One decision per merchant pattern per user (prevents duplicate rows and lets
  -- confirm/ignore upsert cleanly).
  constraint recurring_expenses_user_merchant_freq_unique
    unique (user_id, normalized_merchant, frequency)
);

-- 2. Indexes -----------------------------------------------------------------

create index if not exists recurring_expenses_user_status_idx
  on public.recurring_expenses (user_id, status);

-- 3. Row Level Security ------------------------------------------------------

alter table public.recurring_expenses enable row level security;

-- Each policy is scoped to the authenticated owner via auth.uid(). user_id is
-- never trusted from the client; inserts must set user_id = auth.uid().

drop policy if exists "recurring_expenses_select_own" on public.recurring_expenses;
create policy "recurring_expenses_select_own"
  on public.recurring_expenses for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recurring_expenses_insert_own" on public.recurring_expenses;
create policy "recurring_expenses_insert_own"
  on public.recurring_expenses for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "recurring_expenses_update_own" on public.recurring_expenses;
create policy "recurring_expenses_update_own"
  on public.recurring_expenses for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recurring_expenses_delete_own" on public.recurring_expenses;
create policy "recurring_expenses_delete_own"
  on public.recurring_expenses for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4. updated_at trigger (reuses the function from 0001_transactions.sql) ------

drop trigger if exists recurring_expenses_set_updated_at on public.recurring_expenses;
create trigger recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row
  execute function public.set_updated_at();
