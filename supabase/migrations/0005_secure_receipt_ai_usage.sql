-- Ledger — lock down the receipt AI usage RPC.
-- Apply after 0004_recurring_expenses.sql (SQL editor or `supabase db push`).
--
-- `increment_receipt_ai_usage` is SECURITY DEFINER (0002_receipts.sql): it writes
-- to receipt_ai_usage, a table whose RLS has no policies, so it runs with the
-- definer's rights and bypasses RLS. Postgres grants EXECUTE on new functions to
-- PUBLIC by default, which means any signed-in client could call it directly —
-- with an arbitrary p_user_id — to inflate another user's daily counter and deny
-- them receipt scanning. Only the Edge Function (service role) should ever invoke
-- it, so revoke EXECUTE from client roles and grant it solely to service_role.

revoke all on function public.increment_receipt_ai_usage(uuid) from public;
revoke all on function public.increment_receipt_ai_usage(uuid) from anon;
revoke all on function public.increment_receipt_ai_usage(uuid) from authenticated;

grant execute on function public.increment_receipt_ai_usage(uuid) to service_role;
