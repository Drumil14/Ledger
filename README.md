# Ledger

**Track less. Spend smarter.**

A premium personal expense tracker built with React Native + Expo. It pairs a
restrained monochrome design system (black / white / warm‑grey, Inter, motion‑led)
with a real production backend: Supabase auth, Row Level Security, AI receipt
scanning, budgets, deterministic insights, recurring‑charge detection, and local
notifications.

> **Recruiter?** You can explore the entire app in seconds — no account, no setup.
> Launch it and tap **Explore demo** on the landing screen. See
> [Explore the demo](#explore-the-demo).

---

## Features

- **Real authentication** — email/password via Supabase, persistent **encrypted**
  session, launch session gate (no login flash for signed‑in users), logout.
- **Expense tracking on Supabase** — add / edit / delete with Row Level Security,
  live Home totals, grouped Transactions list with search, category filter, and
  swipe‑to‑delete.
- **Receipt scanning → AI extraction → confirm** — camera or photo import → a
  secure Supabase Edge Function (Anthropic vision) → review on the shared form →
  private receipt‑image storage. The API key never touches the client.
- **Monthly budgets** — per‑user, per‑month budgets (RLS), Home progress ring,
  over‑budget copy, and budget history.
- **Insights** — month total, month‑over‑month comparison, category breakdown,
  “what changed,” spending pace, projection, budget status, largest purchases,
  and “worth noticing.” Every insight is **derived** by a pure analytics engine
  from transactions — no hardcoded copy.
- **Recurring detection** — a deterministic, AI‑free engine groups by normalized
  merchant and detects subscriptions from amount + interval consistency; confirm /
  ignore decisions persist, with real monthly / annual totals.
- **Local notifications** — recurring‑charge reminders, budget‑threshold alerts
  (75 / 90 / 100%), and a monthly summary. All scheduling logic is pure and
  unit‑tested; the service layer is the only code that touches the OS.
- **Demo mode** — a fully populated, offline, account‑free tour of the product
  (see below).

## Explore the demo

Demo mode lets anyone experience the real product immediately, with realistic
data, and **without ever writing to Supabase, calling Anthropic, or requesting
notification permission**.

From the auth landing, tap **Explore demo**:

1. Home opens fully populated (~3 months of history, a healthy budget).
2. Tap a tall bar in the spending chart → inspect that day → open a transaction.
3. Add / edit / delete an expense → Home and Insights update live.
4. Open **Recurring** (confirmed subscriptions + a live candidate) and **Budget**.
5. **Add → Try sample receipt** → watch the processing → review → confirm flow
   with a bundled sample (no camera, no network, no AI cost).
6. **Profile → Reset demo data** restores the original dataset; **Exit demo**
   returns to the landing screen.

Demo data is deterministic and **session‑scoped in memory**: your changes stick
while you explore, and a reset or fresh launch brings the original data back. Real
and demo data can never mix. See [`src/features/demo`](src/features/demo) —
notably `repositories.ts`, the single boundary where real‑vs‑demo is decided.

## Stack

React Native · Expo SDK 57 (New Architecture + React Compiler) · TypeScript ·
Expo Router (typed routes) · Reanimated 4 · Gesture Handler · React Hook Form ·
Zod · Supabase · TanStack Query · Inter.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase values
npm start              # then press i / a, or scan with Expo Go

npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
npm test               # jest  (211 tests)
```

> Reanimated 4 + Gesture Handler run on the New Architecture, which Expo Go
> (SDK 57) supports. For a fully native build use `npx expo run:ios|android`, or
> build in the cloud with EAS (`development` / `preview` / `production` profiles in
> `eas.json`).
>
> The app boots without Supabase configured — auth reports a clear “not
> configured” message and the session gate routes to the landing screen. **Demo
> mode works with no backend at all.**

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**, copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   Put both in `.env` (see `.env.example`). These are public‑safe; **never** add
   the `service_role` key to the client.
3. **Authentication → Providers → Email**: enable it. For the fastest local
   testing, turn **off** “Confirm email” (otherwise new sign‑ups must confirm via
   email before they can log in).
4. **Apply the database migrations** — in **SQL Editor**, run in order (or
   `supabase db push`):
   - `supabase/migrations/0001_transactions.sql` — `transactions` table, indexes,
     `updated_at` trigger, and RLS.
   - `0002_receipts.sql` — receipt columns, the private `receipts` Storage bucket
     with owner‑only policies, and the `receipt_ai_usage` rate‑limit table.
   - `0003_budgets.sql` — `budgets` table (one per user per month, RLS,
     `unique(user_id, month)`).
   - `0004_recurring_expenses.sql` — `recurring_expenses` table (RLS, unique per
     user + normalized merchant + frequency).
5. Restart the dev server after editing `.env` (`EXPO_PUBLIC_*` vars are inlined at
   bundle time).

### Receipt scanning (AI) setup

The AI never runs in the app — it lives in a Supabase Edge Function, so no API key
is ever in the client bundle.

1. Set the AI key as a **function secret** (never `EXPO_PUBLIC_*`):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # optional overrides:
   # supabase secrets set RECEIPT_AI_MODEL=claude-opus-4-8
   # supabase secrets set RECEIPT_AI_DAILY_LIMIT=40
   ```
2. Deploy the function:
   ```bash
   supabase functions deploy extract-receipt
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
   injected automatically. JWT verification is on by default, and the function
   also re‑derives the user from the session and enforces a per‑user daily cap.
3. Without deployment the app still works — scanning fails gracefully with a
   retry / “Enter manually” path, manual entry never needs the network, and
   **demo mode’s “Try sample receipt” needs no function at all**.

### Verifying Row Level Security

RLS is enforced with `auth.uid() = user_id` for select/insert/update/delete, so a
user can only ever touch their own rows. To verify manually:

1. Sign up as **User A**, add a couple of expenses, and copy one row’s `id` from
   the Supabase **Table editor**.
2. Sign out, sign up as **User B**. User B’s Transactions list must be empty and
   Home must read `$0.00`.
3. In the **SQL Editor**, impersonate User B (role/user switcher), then run
   `select * from transactions;` — you should see only User B’s rows, and
   `update transactions set amount = 0 where id = '<User A row id>';` /
   `delete from transactions where id = '<User A row id>';` must affect **0 rows**.
4. In the app, User B cannot see, edit, or delete any of User A’s data through any
   screen. Data persists across restarts (the encrypted session is restored on
   launch).

Sessions are stored encrypted: a per‑key AES‑256 key lives in the device keychain
(Expo SecureStore) and the encrypted session blob lives in AsyncStorage, so it
survives SecureStore’s 2 KB limit. When you add tables, enable **Row Level
Security** so users only ever read their own rows.

## Architecture

Domain logic is deliberately pure and framework‑free: money, month math, budget
status, insights analytics, recurring detection, day summaries, and notification
scheduling are all deterministic functions with no React / Supabase / Expo
imports — which is why they’re exhaustively unit‑tested (211 tests). Screens read
through TanStack Query hooks; those hooks call a thin **repository** layer that
selects the real Supabase service or the in‑memory demo store. That single
boundary is what keeps real and demo cleanly separated with no `if (demo)`
scattered through the UI.

```
UI → feature hooks → repository ─┬─ real service → Supabase
                                 └─ demo store (in‑memory, deterministic)
```

```
src/
  app/                     # Expo Router routes only
    index.tsx              # launch animation + session/demo gate
    (auth)/                # landing (+ Explore demo), login, register
    (app)/(tabs)/          # home, transactions, insights, profile
    (app)/                 # add-expense, budget, recurring, notifications,
                           #   receipt / scan-receipt / receipt-view, transaction/[id]
  components/              # reusable primitives (design system)
  features/                # auth, splash, home, transactions, budgets, insights,
                           #   recurring, notifications, receipts, navigation, demo
  services/                # Supabase data access (transactions, budgets,
                           #   recurring, receipts, notifications)
  types/ constants/ lib/   # domain types, design tokens + categories, cross‑cutting
supabase/
  functions/extract-receipt/   # secure AI receipt extraction (Anthropic)
  migrations/                   # 0001–0004 SQL migrations
```

## Testing

```bash
npm test
```

Unit tests cover money/date math, budget and analytics engines, recurring
detection, notification scheduling, transaction/receipt schemas, and the full
demo layer (deterministic dataset, relative‑month generation, in‑memory store
CRUD, repository routing, and real/demo isolation).

## License

Personal project — all rights reserved.
