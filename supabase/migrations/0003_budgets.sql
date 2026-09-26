-- Ledger — monthly budgets. One budget per user per month.
-- Apply after 0002_receipts.sql (SQL editor or `supabase db push`).

-- 1. Table -------------------------------------------------------------------

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Normalized to the first day of the month (e.g. 2026-09-01).
  month date not null,
  limit_amount numeric(12, 2) not null check (limit_amount > 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Prevents duplicate budgets for the same month.
  constraint budgets_user_month_unique unique (user_id, month)
);

create index if not exists budgets_user_month_idx
  on public.budgets (user_id, month desc);

-- 2. Row Level Security ------------------------------------------------------

alter table public.budgets enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own"
  on public.budgets for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own"
  on public.budgets for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own"
  on public.budgets for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3. updated_at trigger (reuses the function from 0001_transactions.sql) ------

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row
  execute function public.set_updated_at();
