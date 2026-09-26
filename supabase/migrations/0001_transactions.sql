-- Ledger — transactions table, indexes, RLS, and updated_at trigger.
-- Apply via the Supabase SQL editor or the CLI (see README "Supabase setup").

-- 1. Table -------------------------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  merchant text not null check (char_length(merchant) between 1 and 120),
  category text not null,
  transaction_date timestamptz not null,
  note text,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'receipt', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes -----------------------------------------------------------------

create index if not exists transactions_user_id_idx
  on public.transactions (user_id);

create index if not exists transactions_transaction_date_idx
  on public.transactions (transaction_date desc);

-- Primary access pattern: a user's transactions, newest first.
create index if not exists transactions_user_id_date_idx
  on public.transactions (user_id, transaction_date desc);

-- 3. Row Level Security ------------------------------------------------------

alter table public.transactions enable row level security;

-- Each policy is scoped to the authenticated owner via auth.uid().
-- user_id is never trusted from the client for reads/updates/deletes, and
-- inserts must set user_id = auth.uid() (enforced by the with check clause).

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4. updated_at trigger ------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_updated_at();
