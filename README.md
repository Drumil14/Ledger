# Ledger

**Track less. Spend smarter.**

A React Native personal expense tracker built with Expo and TypeScript. Ledger combines expense tracking, AI-assisted receipt extraction, monthly budgets, deterministic spending analytics, recurring-expense detection, and native mobile interactions in a restrained monochrome interface.

[**Live Demo**](https://ledger-six-kohl.vercel.app/home) · [**GitHub**](https://github.com/Drumil14/Ledger)

> **No account required for the demo.** The public demo runs entirely on deterministic local data and never writes to Supabase or calls the receipt AI service.

---

## Product

Ledger is designed around a simple idea: logging an expense should be fast, but understanding spending should require even less effort.

Users can manually add expenses or scan a receipt, set monthly budgets, inspect spending patterns, identify recurring charges, and drill from monthly totals down to individual transactions.

### Core experience

- **Expense tracking** — create, edit, delete, search, filter, and inspect transactions.
- **Interactive spending chart** — tap any day to see exactly what contributed to that day's spending.
- **Receipt scanning** — camera/photo → AI extraction → user review → transaction.
- **Monthly budgets** — track remaining budget, utilization, and historical budgets.
- **Spending insights** — category breakdowns, month-over-month changes, spending pace, projections, and largest purchases.
- **Recurring detection** — deterministically identify repeated charges and confirm or ignore candidates.
- **Local notifications** — recurring-charge reminders, budget thresholds, and optional monthly summaries.
- **Recruiter Demo Mode** — explore the complete product without creating an account.

---

## Live Demo

**[Open the interactive Ledger demo →](https://ledger-six-kohl.vercel.app/home)**

The browser demo runs the real Ledger interface inside a mobile presentation frame on desktop and adapts to the full viewport on mobile.

Demo Mode includes roughly three months of deterministic spending history, budgets, confirmed recurring expenses, a potential recurring candidate, and a sample receipt flow.

You can:

1. Tap the Home spending chart to inspect a day's expenses.
2. Add, edit, or delete transactions and watch totals update.
3. Explore deterministic Insights and month-over-month comparisons.
4. Review recurring expenses and budget progress.
5. Use **Try sample receipt** to experience the receipt-review flow without a camera or AI request.
6. Reset the dataset from Profile at any time.

Demo mutations exist only in memory. Refreshing or resetting restores the original dataset.

---

## Receipt extraction

Ledger uses AI where it is useful: **understanding unstructured receipt images**.

```text
Camera / Photo
      ↓
Supabase Edge Function
      ↓
Anthropic Vision
      ↓
Schema validation
      ↓
Receipt review
      ↓
User confirmation
      ↓
Transaction
```

The model returns structured receipt information such as:

- merchant
- total
- transaction date
- category suggestion
- tax / tip
- line items
- field confidence

AI output is never saved automatically. The user reviews the extracted information before a transaction is created.

The Anthropic API key remains server-side inside the Supabase Edge Function environment.

---

## Deterministic financial analytics

AI does **not** calculate Ledger's financial data.

Totals, category analysis, budget status, projections, comparisons, recurring detection, and spending insights are implemented as deterministic TypeScript functions.

```text
Transactions
     ↓
Pure analytics functions
     ↓
Verified derived data
     ↓
Insights UI
```

This keeps financial calculations reproducible, testable, and independent of model output.

Ledger currently derives:

- monthly spending
- previous-month comparisons
- category totals and changes
- same-day spending pace
- current-month projections
- largest purchases
- weekend spending
- budget utilization
- concise prioritized observations

---

## Recurring expense detection

Recurring charges are detected without AI.

Ledger groups transaction history using:

- normalized merchant names
- amount similarity
- transaction intervals
- recurrence frequency
- evidence count

Supported patterns include monthly, weekly, biweekly, quarterly, and yearly recurrence.

A detected pattern is surfaced as a **potential recurring expense** before the user decides whether to confirm or ignore it.

Confirmed recurring expenses are then used to calculate monthly recurring spend, estimated yearly cost, and expected next-charge dates.

---

## Architecture

Ledger keeps presentation, data access, and domain logic separated.

```text
React Native UI
      ↓
Feature hooks
      ↓
TanStack Query
      ↓
Repository boundary
   ↙                 ↘
Demo Store        Services
(in-memory)           ↓
                  Supabase
```

The repository layer is also what makes Demo Mode possible without duplicating application logic.

The same:

- budget calculations
- Insights engine
- recurring detector
- transaction logic
- day summaries
- money helpers

run in both the real application and the demo.

Only the underlying data source changes.

### Demo isolation

```text
Demo Mode
    ↓
In-memory DemoStore
    ↓
Existing application logic

Real Account
    ↓
Supabase services
    ↓
PostgreSQL + RLS
```

Demo Mode never:

- writes to Supabase
- calls Anthropic
- uploads receipt images
- requests OS notification permission
- mixes data with authenticated users

---

## Security

Ledger's backend is built around user-level isolation.

### Supabase

- Row Level Security on user-owned tables
- `auth.uid() = user_id` ownership policies
- user ID derived from the authenticated session
- private receipt storage
- short-lived signed URLs for receipt viewing

### Receipt AI

- Anthropic key exists only inside the Edge Function environment
- Edge Function validates the authenticated user
- receipt payloads are validated before processing
- per-user AI usage is rate-limited
- AI output is schema-validated before reaching the client

### Session storage

Authentication sessions are encrypted before being persisted locally using a key stored through Expo SecureStore.

No Supabase service-role key or Anthropic API key is included in the client application.

---

## Mobile interactions

Ledger uses native interaction patterns throughout the product:

- Reanimated transitions
- swipe-to-delete gestures
- haptic feedback
- bottom sheets
- camera and image-picker flows
- local notifications
- safe-area handling
- keyboard-aware forms
- Reduce Motion support
- screen-reader labels for charts and financial summaries

The visual system uses only black, white, and warm greys with Inter typography and restrained motion.

---

## Tech stack

| Area | Technology |
| --- | --- |
| Mobile | React Native, Expo |
| Language | TypeScript |
| Routing | Expo Router |
| Server state | TanStack Query |
| Forms | React Hook Form |
| Validation | Zod |
| Database | PostgreSQL / Supabase |
| Authentication | Supabase Auth |
| Backend | Supabase Edge Functions |
| Receipt AI | Anthropic |
| Animation | React Native Reanimated |
| Gestures | React Native Gesture Handler |
| Notifications | Expo Notifications |
| Camera / Photos | Expo Camera, Expo Image Picker |
| Local storage | AsyncStorage, SecureStore |
| Testing | Jest |
| Web demo | Expo Web, Vercel |

---

## Testing

Ledger currently has **211 passing tests** covering critical application and domain behavior.

Tested areas include:

- money calculations
- date and month utilities
- transaction validation
- receipt mapping
- budget calculations
- spending analytics
- category comparisons
- spending projections
- recurring detection
- merchant normalization
- notification scheduling
- budget notification thresholds
- chart-day transaction filtering
- Demo Mode data generation
- Demo Store CRUD
- repository routing
- real/demo isolation

Run the quality checks with:

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx jest
```

---

## Project structure

```text
src/
├── app/
│   ├── (auth)/              # Landing, login, register
│   ├── (app)/
│   │   ├── (tabs)/          # Home, Activity, Insights, Profile
│   │   ├── budget.tsx
│   │   ├── recurring.tsx
│   │   ├── notifications.tsx
│   │   ├── receipt.tsx
│   │   └── transaction/
│   └── demo.tsx             # Recruiter web-demo entry
│
├── components/              # Shared UI primitives
│
├── features/
│   ├── auth/
│   ├── budgets/
│   ├── demo/
│   ├── home/
│   ├── insights/
│   ├── notifications/
│   ├── receipts/
│   ├── recurring/
│   └── transactions/
│
├── services/                # Supabase / native service boundaries
├── lib/                     # Money, dates, helpers
└── constants/               # Design tokens and categories

supabase/
├── functions/
│   └── extract-receipt/
└── migrations/
    ├── 0001_transactions.sql
    ├── 0002_receipts.sql
    ├── 0003_budgets.sql
    └── 0004_recurring_expenses.sql
```

---

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env` from `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Only public Supabase client configuration belongs here.

Never place:

```text
ANTHROPIC_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

inside `EXPO_PUBLIC_*` variables.

### 3. Start Expo

```bash
npx expo start
```

The public Demo Mode can operate without a configured backend.

Real authentication, persistence, and receipt scanning require Supabase configuration.

---

## Supabase setup

Create a Supabase project and configure:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Then apply the migrations in order:

```text
0001_transactions.sql
0002_receipts.sql
0003_budgets.sql
0004_recurring_expenses.sql
```

They create the transaction, receipt, budget, recurring-expense, storage, indexing, trigger, and Row Level Security infrastructure used by Ledger.

---

## Receipt AI setup

Receipt extraction runs through:

```text
supabase/functions/extract-receipt
```

Set the Anthropic API key as a Supabase Function secret:

```bash
supabase secrets set ANTHROPIC_API_KEY=YOUR_KEY
```

Optional configuration:

```bash
supabase secrets set RECEIPT_AI_MODEL=YOUR_MODEL
supabase secrets set RECEIPT_AI_DAILY_LIMIT=40
```

Then deploy:

```bash
supabase functions deploy extract-receipt
```

The key is never included in the React Native bundle.

Demo Mode does not require this function and instead uses a deterministic bundled sample receipt.

---

## Database

Ledger currently uses four primary migrations:

| Migration | Purpose |
| --- | --- |
| `0001_transactions.sql` | Transactions, indexes, timestamps, RLS |
| `0002_receipts.sql` | Receipt metadata, private storage, AI usage limits |
| `0003_budgets.sql` | Monthly user budgets |
| `0004_recurring_expenses.sql` | Confirmed / ignored recurring patterns |

Every user-owned table is protected with Row Level Security.

---

## Builds

Ledger is configured for EAS with:

```text
development
preview
production
```

build profiles.

An Android standalone preview build has been successfully produced through EAS.

The application is **not currently published on the App Store or Google Play**.

---

## Web demo

The recruiter demo is exported with Expo Web and deployed on Vercel.

**Live:**  
https://ledger-six-kohl.vercel.app/home

On desktop, Ledger is presented inside a mobile device frame. On smaller/mobile browsers, the interface adapts to the available viewport.

The deployed demo runs entirely against the local deterministic Demo Store.

---

## Engineering highlights

A few implementation decisions that shaped the project:

**Deterministic analytics**  
Financial calculations stay outside the AI layer and are implemented as pure TypeScript functions.

**Repository-driven Demo Mode**  
A single data-source boundary lets the complete application operate either against Supabase or an in-memory demo store without duplicating business logic.

**User-confirmed AI extraction**  
Receipt AI assists with structured extraction but never automatically commits financial data.

**Explainable recurring detection**  
Users see the transaction history that caused a recurring pattern to be detected before confirming it.

**Notification deduplication**  
Budget threshold alerts track previously-fired thresholds so users are not repeatedly notified after crossing 75%, 90%, or 100%.

**Interactive chart drill-down**  
The Home chart is functional rather than decorative: selecting a day opens the exact transactions contributing to that day's spend.

---

## Status

Ledger is a personal portfolio project built to explore production-oriented React Native architecture, mobile UX, deterministic financial analytics, AI-assisted workflows, and secure user data handling.

The product feature set is currently frozen while the project is being packaged for portfolio presentation.

---

## License

Personal project. All rights reserved.
