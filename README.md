# Ledger

**Track less. Spend smarter.**

A premium personal expense tracker built with React Native + Expo. Monochrome
(black / white / warm-grey) visual system, Inter throughout, motion-led.

## Status

- Animated Ledger launch sequence (Reanimated)
- Auth landing / register / login with polished transitions, keyboard handling,
  Zod validation, haptics
- **Real Supabase authentication** (email/password), persistent encrypted
  session, launch session gate, logout
- Main tab navigation (custom monochrome tab bar)
- **Functional expense tracking on Supabase**: add / edit / delete expenses with
  Row Level Security, real Home totals, grouped Transactions list with search +
  filter + swipe-to-delete
- **Receipt scanning → AI extraction → confirm → transaction**: camera / photo
  import → secure Edge Function (Anthropic vision) → confirmation on the shared
  form → private receipt image storage
- **Monthly budgets**: per-user, month-specific budgets in Supabase (RLS), real
  Home progress, create / edit / remove, over-budget copy, budget history

Next phases (AI insights, recurring detection, notifications) are not built yet.

## Stack

React Native · Expo SDK 57 (New Architecture + React Compiler) · TypeScript ·
Expo Router · Reanimated 4 · Gesture Handler · React Hook Form · Zod · Supabase ·
TanStack Query · Inter.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase values
npm start              # then press i / a, or scan with Expo Go
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
npm test               # jest
```

> Reanimated 4 + Gesture Handler run on the New Architecture, which Expo Go
> (SDK 57) supports. For a fully native build use `npx expo run:ios|android`.
> The app boots without Supabase configured — auth just reports a clear
> "not configured" message and the session gate routes to the auth landing.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**, copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   Put both in `.env` (see `.env.example`). These are public-safe; **never** add
   the `service_role` key to the client.
3. **Authentication → Providers → Email**: enable it. For the fastest local
   testing, turn **off** "Confirm email" (otherwise new sign-ups must confirm via
   email before they can log in).
4. **Apply the database migrations**: open **SQL Editor** and run, in order, the
   contents of `supabase/migrations/0001_transactions.sql`,
   `0002_receipts.sql`, then `0003_budgets.sql` (or `supabase db push`). Together
   these create the `transactions` table + indexes + `updated_at` trigger + RLS,
   the receipt columns, the private `receipts` Storage bucket with owner-only
   policies, the `receipt_ai_usage` rate-limit table, and the `budgets` table
   (one per user per month, RLS, `unique(user_id, month)`).
5. Restart the dev server after editing `.env` (`EXPO_PUBLIC_*` vars are inlined
   at bundle time).

### Receipt scanning (AI) setup

The AI never runs in the app — it lives in a Supabase Edge Function so no API key
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
   also re-derives the user from the session and enforces a per-user daily cap.
3. Without deployment the app still works — scanning fails gracefully with a
   retry / "Enter manually" path; manual entry never needs the network.

### Verifying Row Level Security

RLS is enforced with `auth.uid() = user_id` for select/insert/update/delete, so a
user can only ever touch their own rows. To verify manually:

1. Sign up as **User A**, add a couple of expenses, and copy one row's `id` from
   the Supabase **Table editor**.
2. Sign out, sign up as **User B**. User B's Transactions list must be empty and
   Home must read `$0.00`.
3. In the **SQL Editor**, run as an authenticated user (impersonation): select
   User B in the editor's role/user switcher, then run
   `select * from transactions;` — you should see only User B's rows, and
   `update transactions set amount = 0 where id = '<User A row id>';` /
   `delete from transactions where id = '<User A row id>';` must affect **0 rows**.
4. In the app, User B cannot see, edit, or delete any of User A's data through any
   screen. Data also persists across app restarts (the encrypted session is
   restored on launch).

Sessions are stored encrypted: a per-key AES-256 key lives in the device keychain
(Expo SecureStore) and the encrypted session blob lives in AsyncStorage, so it
survives SecureStore's 2 KB limit. When you add tables, enable **Row Level
Security** so users only ever read their own rows.

## Architecture

```
src/
  app/                # Expo Router routes only
    index.tsx         # launch animation + session gate
    (auth)/           # landing, login, register
    (app)/            # authenticated tabs: home, transactions, add, insights, profile
    (app)/            # Stack: (tabs) + add-expense & transaction/[id] modals
  components/          # reusable primitives (design system)
  features/            # feature modules (auth, splash, home, transactions, navigation)
  services/            # data access (Supabase transactions; budget still mock)
  types/               # shared domain types
  constants/           # design tokens (theme.ts), categories
  lib/                 # cross-cutting (supabase, haptics, env, money, errors, query client)
supabase/migrations/   # SQL migration(s)
```
