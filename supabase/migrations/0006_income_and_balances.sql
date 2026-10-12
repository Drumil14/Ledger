-- Ledger — income sources and user-declared balance snapshots (forecasting).
-- Apply after 0005_secure_receipt_ai_usage.sql (SQL editor or `supabase db push`).
--
-- Both tables are per-user with strict owner-only RLS (auth.uid() = user_id),
-- mirroring transactions/budgets/recurring. Money is integer cents (bigint).
-- A balance is ALWAYS explicitly declared by the user — nothing here is derived
-- from spending history.

-- 1. Income sources ----------------------------------------------------------

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- Positive cents received on each occurrence.
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',
  frequency text not null
    check (frequency in ('weekly', 'biweekly', 'monthly', 'one-time', 'custom')),
  -- Monthly cadence day-of-month (1..31); the day intent is preserved/clamped
  -- per month by the forecasting engine.
  day_of_month integer check (day_of_month between 1 and 31),
  -- Custom cadence explicit dates (array of 'YYYY-MM-DD' strings).
  custom_dates jsonb,
  -- Anchor / first date; also the single date for one-time income.
  start_date date not null,
  -- Optional last date after which the source no longer pays out.
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Integrity: end can't precede start; cadence-specific fields must be present.
  constraint income_end_after_start check (end_date is null or end_date >= start_date),
  constraint income_monthly_requires_day
    check (frequency <> 'monthly' or day_of_month is not null),
  constraint income_custom_requires_dates
    check (frequency <> 'custom' or (custom_dates is not null and jsonb_typeof(custom_dates) = 'array'))
);

create index if not exists income_sources_user_id_idx
  on public.income_sources (user_id);

create index if not exists income_sources_user_active_idx
  on public.income_sources (user_id, is_active);

alter table public.income_sources enable row level security;

drop policy if exists "income_sources_select_own" on public.income_sources;
create policy "income_sources_select_own"
  on public.income_sources for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "income_sources_insert_own" on public.income_sources;
create policy "income_sources_insert_own"
  on public.income_sources for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "income_sources_update_own" on public.income_sources;
create policy "income_sources_update_own"
  on public.income_sources for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "income_sources_delete_own" on public.income_sources;
create policy "income_sources_delete_own"
  on public.income_sources for delete
  to authenticated
  using (auth.uid() = user_id);

-- updated_at trigger (reuses the function from 0001_transactions.sql)
drop trigger if exists income_sources_set_updated_at on public.income_sources;
create trigger income_sources_set_updated_at
  before update on public.income_sources
  for each row
  execute function public.set_updated_at();

-- 2. Balance snapshots -------------------------------------------------------
-- A user-declared account balance at a point in time. May be negative (overdraft
-- / debt), so there is no sign check. One snapshot per user per effective date.

create table if not exists public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'USD',
  effective_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint balance_snapshots_user_date_unique unique (user_id, effective_date)
);

create index if not exists balance_snapshots_user_date_idx
  on public.balance_snapshots (user_id, effective_date desc);

alter table public.balance_snapshots enable row level security;

drop policy if exists "balance_snapshots_select_own" on public.balance_snapshots;
create policy "balance_snapshots_select_own"
  on public.balance_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "balance_snapshots_insert_own" on public.balance_snapshots;
create policy "balance_snapshots_insert_own"
  on public.balance_snapshots for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "balance_snapshots_update_own" on public.balance_snapshots;
create policy "balance_snapshots_update_own"
  on public.balance_snapshots for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "balance_snapshots_delete_own" on public.balance_snapshots;
create policy "balance_snapshots_delete_own"
  on public.balance_snapshots for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists balance_snapshots_set_updated_at on public.balance_snapshots;
create trigger balance_snapshots_set_updated_at
  before update on public.balance_snapshots
  for each row
  execute function public.set_updated_at();
