/**
 * Repository selection layer.
 *
 * This is the single boundary where "real vs demo" is decided. Feature query
 * hooks import these repositories instead of the raw services, so the branch
 * lives in exactly one place — never scattered as `if (demo)` through screens or
 * business logic. When demo mode is active every call is served from the
 * in-memory `DemoStore`; otherwise it goes to the real Supabase-backed service.
 *
 *   query hook → repository → { demo store | real service → Supabase }
 */

import * as budgetsService from '@/services/budgets';
import * as recurringService from '@/services/recurring';
import * as transactionsService from '@/services/transactions';
import type { CreateTransactionInput, UpdateTransactionInput } from '@/services/transactions';
import type { UpsertBudgetInput } from '@/services/budgets';
import type { UpsertRecurringInput } from '@/services/recurring';

import { getDemoStore, isDemoActive } from './demo-runtime';

export const transactionsRepo = {
  fetch: () =>
    isDemoActive() ? getDemoStore().fetchTransactions() : transactionsService.fetchTransactions(),
  create: (input: CreateTransactionInput) =>
    isDemoActive()
      ? getDemoStore().createTransaction(input)
      : transactionsService.createTransaction(input),
  update: (input: UpdateTransactionInput) =>
    isDemoActive()
      ? getDemoStore().updateTransaction(input)
      : transactionsService.updateTransaction(input),
  remove: (id: string) =>
    isDemoActive() ? getDemoStore().deleteTransaction(id) : transactionsService.deleteTransaction(id),
};

export const budgetsRepo = {
  fetchOne: (monthKey: string) =>
    isDemoActive() ? getDemoStore().fetchBudget(monthKey) : budgetsService.fetchBudget(monthKey),
  fetchAll: () => (isDemoActive() ? getDemoStore().fetchBudgets() : budgetsService.fetchBudgets()),
  upsert: (input: UpsertBudgetInput) =>
    isDemoActive() ? getDemoStore().upsertBudget(input) : budgetsService.upsertBudget(input),
  remove: (monthKey: string) =>
    isDemoActive() ? getDemoStore().deleteBudget(monthKey) : budgetsService.deleteBudget(monthKey),
};

export const recurringRepo = {
  fetch: () =>
    isDemoActive()
      ? getDemoStore().fetchRecurringExpenses()
      : recurringService.fetchRecurringExpenses(),
  confirm: (input: UpsertRecurringInput) =>
    isDemoActive() ? getDemoStore().confirmRecurring(input) : recurringService.confirmRecurring(input),
  ignore: (input: UpsertRecurringInput) =>
    isDemoActive() ? getDemoStore().ignoreRecurring(input) : recurringService.ignoreRecurring(input),
  remove: (id: string) =>
    isDemoActive() ? getDemoStore().deleteRecurring(id) : recurringService.deleteRecurring(id),
};
