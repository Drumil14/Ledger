/**
 * In-memory demo store.
 *
 * Mirrors the async signatures of the real Supabase service functions
 * (`@/services/transactions`, `@/services/budgets`, `@/services/recurring`) so
 * the repository layer can swap it in behind the exact same query/mutation code.
 * Nothing here ever touches the network: all data is session-scoped and held in
 * memory. `reset()` restores the original deterministic dataset.
 *
 * Mutations (add/edit/delete/confirm) affect only this in-memory copy, so the
 * recruiter can freely change things during a session without ever writing to a
 * real backend, and a reset or a fresh app launch brings the original data back.
 */

import { monthStartISO } from '@/lib/month';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/services/transactions';
import type { UpsertBudgetInput } from '@/services/budgets';
import type { UpsertRecurringInput } from '@/services/recurring';
import type { RecurringExpense, RecurringStatus } from '@/types/recurring';
import type { Budget, Transaction } from '@/types/transaction';

import { generateDemoDataset } from './demo-data';

export class DemoStore {
  private transactions: Transaction[] = [];
  private budgets: Budget[] = [];
  private recurring: RecurringExpense[] = [];
  private seq = 0;

  constructor(private readonly referenceDate: Date = new Date()) {
    this.reset();
  }

  /** Restore the pristine deterministic dataset (used by "Reset demo data"). */
  reset(): void {
    const data = generateDemoDataset(this.referenceDate);
    this.transactions = data.transactions.map((t) => ({ ...t }));
    this.budgets = data.budgets.map((b) => ({ ...b }));
    this.recurring = data.recurring.map((r) => ({ ...r }));
    this.seq = 0;
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `demo-${prefix}-live-${this.seq}`;
  }

  /* ----------------------------- Transactions ---------------------------- */

  async fetchTransactions(): Promise<Transaction[]> {
    return this.transactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const transaction: Transaction = {
      id: this.nextId('tx'),
      amount: input.amount,
      currency: input.currency ?? 'USD',
      merchant: input.merchant,
      category: input.category,
      date: input.date,
      note: input.note,
      sourceType: input.sourceType ?? 'manual',
      receiptPath: input.receiptPath,
      receiptItems: input.receiptItems,
    };
    this.transactions.push(transaction);
    return { ...transaction };
  }

  async updateTransaction(input: UpdateTransactionInput): Promise<Transaction> {
    const existing = this.transactions.find((t) => t.id === input.id);
    if (!existing) throw new Error('Transaction not found');

    if (input.amount !== undefined) existing.amount = input.amount;
    if (input.currency !== undefined) existing.currency = input.currency;
    if (input.merchant !== undefined) existing.merchant = input.merchant;
    if (input.category !== undefined) existing.category = input.category;
    if (input.date !== undefined) existing.date = input.date;
    if (input.note !== undefined) existing.note = input.note;

    return { ...existing };
  }

  async deleteTransaction(id: string): Promise<void> {
    this.transactions = this.transactions.filter((t) => t.id !== id);
  }

  /* -------------------------------- Budgets ------------------------------ */

  async fetchBudget(monthKey: string): Promise<Budget | null> {
    const target = monthStartISO(monthKey);
    return this.budgets.find((b) => b.month === target) ?? null;
  }

  async fetchBudgets(): Promise<Budget[]> {
    return this.budgets.slice().sort((a, b) => (a.month < b.month ? 1 : -1));
  }

  async upsertBudget(input: UpsertBudgetInput): Promise<Budget> {
    const month = monthStartISO(input.monthKey);
    const existing = this.budgets.find((b) => b.month === month);
    if (existing) {
      existing.limit = input.limit;
      existing.currency = input.currency ?? existing.currency;
      return { ...existing };
    }
    const budget: Budget = {
      id: this.nextId('budget'),
      month,
      limit: input.limit,
      currency: input.currency ?? 'USD',
    };
    this.budgets.push(budget);
    return { ...budget };
  }

  async deleteBudget(monthKey: string): Promise<void> {
    const month = monthStartISO(monthKey);
    this.budgets = this.budgets.filter((b) => b.month !== month);
  }

  /* ------------------------------ Recurring ------------------------------ */

  async fetchRecurringExpenses(): Promise<RecurringExpense[]> {
    return this.recurring
      .slice()
      .sort((a, b) => (b.expectedAmount ?? 0) - (a.expectedAmount ?? 0));
  }

  async confirmRecurring(input: UpsertRecurringInput): Promise<RecurringExpense> {
    return this.upsertDecision(input, 'confirmed');
  }

  async ignoreRecurring(input: UpsertRecurringInput): Promise<RecurringExpense> {
    return this.upsertDecision(input, 'ignored');
  }

  async deleteRecurring(id: string): Promise<void> {
    this.recurring = this.recurring.filter((r) => r.id !== id);
  }

  /** Upsert on (normalizedMerchant, frequency), mirroring the real conflict key. */
  private upsertDecision(
    input: UpsertRecurringInput,
    status: RecurringStatus
  ): RecurringExpense {
    const existing = this.recurring.find(
      (r) => r.normalizedMerchant === input.normalizedMerchant && r.frequency === input.frequency
    );
    if (existing) {
      existing.merchant = input.merchant;
      existing.expectedAmount = input.expectedAmount;
      existing.nextExpectedDate = input.nextExpectedDate ?? null;
      existing.status = status;
      existing.source = 'detected';
      existing.lastTransactionId = input.lastTransactionId ?? undefined;
      existing.lastDetectedAt = new Date().toISOString();
      return { ...existing };
    }
    const record: RecurringExpense = {
      id: this.nextId('recurring'),
      merchant: input.merchant,
      normalizedMerchant: input.normalizedMerchant,
      expectedAmount: input.expectedAmount,
      frequency: input.frequency,
      nextExpectedDate: input.nextExpectedDate ?? null,
      status,
      source: 'detected',
      lastTransactionId: input.lastTransactionId ?? undefined,
      lastDetectedAt: new Date().toISOString(),
    };
    this.recurring.push(record);
    return { ...record };
  }
}
