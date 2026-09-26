-- Ledger — receipt support: transaction columns, a private Storage bucket with
-- owner-only policies, and a per-user AI usage table for rate limiting.
-- Apply after 0001_transactions.sql (SQL editor or `supabase db push`).

-- 1. Transaction columns -----------------------------------------------------

alter table public.transactions
  add column if not exists receipt_path text,
  add column if not exists receipt_items jsonb;

-- 2. Private Storage bucket for receipt images -------------------------------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Owner-only access. Objects are stored at `{user_id}/...`, so the first path
-- segment must equal the caller's uid. Receipts are never publicly readable.
drop policy if exists "receipts_select_own" on storage.objects;
create policy "receipts_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_update_own" on storage.objects;
create policy "receipts_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. AI usage (rate limiting) ------------------------------------------------
-- One row per user per day. Only the Edge Function (service role) touches this;
-- RLS is enabled with no policies, so clients cannot read or write it.

create table if not exists public.receipt_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.receipt_ai_usage enable row level security;

-- Atomic increment + read used by the Edge Function to enforce a daily cap.
create or replace function public.increment_receipt_ai_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.receipt_ai_usage (user_id, day, count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set count = public.receipt_ai_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
