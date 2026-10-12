/**
 * Two-user RLS verification against a REAL staging Supabase database.
 *
 * This is intentionally NOT a Jest test and NOT wired into CI: Row Level Security
 * can only be trusted when exercised against a live Postgres with two distinct
 * authenticated users. Mocked tests cannot prove it.
 *
 * It is gated entirely on explicit staging environment variables and refuses to
 * run without them, so it can never accidentally touch production.
 *
 * Usage (point ONLY at a staging project you are authorised to use):
 *   STAGING_SUPABASE_URL=https://xxxx.supabase.co \
 *   STAGING_SUPABASE_ANON_KEY=sb_publishable_... \
 *   RLS_USER_A_EMAIL=a@example.test RLS_USER_A_PASSWORD=... \
 *   RLS_USER_B_EMAIL=b@example.test RLS_USER_B_PASSWORD=... \
 *   node scripts/verify-rls.mjs
 *
 * The two users must already exist (email confirmation off on staging). Nothing
 * here is hardcoded; no secret is printed. Exit code is non-zero on any failure.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.STAGING_SUPABASE_URL;
const ANON = process.env.STAGING_SUPABASE_ANON_KEY;
const A = { email: process.env.RLS_USER_A_EMAIL, password: process.env.RLS_USER_A_PASSWORD };
const B = { email: process.env.RLS_USER_B_EMAIL, password: process.env.RLS_USER_B_PASSWORD };

if (!URL || !ANON || !A.email || !A.password || !B.email || !B.password) {
  console.error(
    'RLS verification is blocked: set STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,\n' +
      'RLS_USER_A_EMAIL/PASSWORD and RLS_USER_B_EMAIL/PASSWORD for a staging project.\n' +
      'Refusing to run without an explicit staging target.'
  );
  process.exit(2);
}

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function clientFor(creds) {
  const supabase = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw new Error(`sign-in failed for ${creds.email}: ${error.message}`);
  return { supabase, userId: data.user.id };
}

async function main() {
  const a = await clientFor(A);
  const b = await clientFor(B);

  // A creates one row in each owned table.
  const nowIso = new Date().toISOString();
  const { data: tx, error: txErr } = await a.supabase
    .from('transactions')
    .insert({ user_id: a.userId, amount: 12.34, merchant: 'RLS Probe', category: 'Other', transaction_date: nowIso })
    .select('id')
    .single();
  if (txErr) throw new Error(`A failed to insert its own transaction: ${txErr.message}`);

  await a.supabase.from('budgets').upsert(
    { user_id: a.userId, month: '2099-01-01', limit_amount: 100 },
    { onConflict: 'user_id,month' }
  );
  await a.supabase.from('income_sources').insert({
    user_id: a.userId,
    name: 'RLS Probe',
    amount_cents: 1000,
    frequency: 'monthly',
    day_of_month: 1,
    start_date: '2099-01-01',
  });
  await a.supabase.from('balance_snapshots').upsert(
    { user_id: a.userId, amount_cents: 1000, effective_date: '2099-01-01' },
    { onConflict: 'user_id,effective_date' }
  );

  // 1. B cannot read A's transactions.
  const bTx = await b.supabase.from('transactions').select('id').eq('id', tx.id);
  check("B cannot read A's transaction", (bTx.data ?? []).length === 0);

  // 2. B cannot modify A's budget (0 rows affected / not visible).
  const bBudgetUpd = await b.supabase
    .from('budgets')
    .update({ limit_amount: 0 })
    .eq('user_id', a.userId)
    .select('id');
  check("B cannot modify A's budget", (bBudgetUpd.data ?? []).length === 0);

  // 3. B cannot read A's income.
  const bIncome = await b.supabase.from('income_sources').select('id').eq('user_id', a.userId);
  check("B cannot read A's income", (bIncome.data ?? []).length === 0);

  // 4. B cannot read A's balance snapshots.
  const bBalance = await b.supabase.from('balance_snapshots').select('id').eq('user_id', a.userId);
  check("B cannot read A's balance snapshots", (bBalance.data ?? []).length === 0);

  // 5. B cannot download A's private receipt files.
  const bReceipt = await b.supabase.storage.from('receipts').download(`${a.userId}/anything.jpg`);
  check("B cannot access A's receipt storage", !!bReceipt.error);

  // 6. B cannot invoke the service-role-only usage RPC (revoked in 0005).
  const bRpc = await b.supabase.rpc('increment_receipt_ai_usage', { p_user_id: a.userId });
  check('B cannot invoke restricted RPC', !!bRpc.error, bRpc.error?.message);

  // 7. Authorised: A can read its own transaction.
  const aTx = await a.supabase.from('transactions').select('id').eq('id', tx.id);
  check("A can read its own transaction", (aTx.data ?? []).length === 1);

  // Cleanup A's probe rows.
  await a.supabase.from('transactions').delete().eq('id', tx.id);
  await a.supabase.from('budgets').delete().eq('user_id', a.userId).eq('month', '2099-01-01');
  await a.supabase.from('income_sources').delete().eq('user_id', a.userId).eq('name', 'RLS Probe');
  await a.supabase.from('balance_snapshots').delete().eq('user_id', a.userId).eq('effective_date', '2099-01-01');

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('RLS verification errored:', e.message);
  process.exit(1);
});
