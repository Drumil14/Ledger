/// <reference types="jest" />
import * as budgetsService from '@/services/budgets';
import * as recurringService from '@/services/recurring';
import * as transactionsService from '@/services/transactions';

import { activateDemo, deactivateDemo } from '../demo-runtime';
import { budgetsRepo, recurringRepo, transactionsRepo } from '../repositories';

// Mock every real service so we can prove demo mode NEVER calls Supabase-backed
// code, and real mode always does. (`jest.mock` is hoisted above the imports.)
jest.mock('@/services/transactions', () => ({
  fetchTransactions: jest.fn().mockResolvedValue([]),
  createTransaction: jest.fn().mockResolvedValue({ id: 'real' }),
  updateTransaction: jest.fn().mockResolvedValue({ id: 'real' }),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/budgets', () => ({
  fetchBudget: jest.fn().mockResolvedValue(null),
  fetchBudgets: jest.fn().mockResolvedValue([]),
  upsertBudget: jest.fn().mockResolvedValue({ id: 'real' }),
  deleteBudget: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/recurring', () => ({
  fetchRecurringExpenses: jest.fn().mockResolvedValue([]),
  confirmRecurring: jest.fn().mockResolvedValue({ id: 'real' }),
  ignoreRecurring: jest.fn().mockResolvedValue({ id: 'real' }),
  deleteRecurring: jest.fn().mockResolvedValue(undefined),
}));

const REF = new Date(2026, 5, 26, 12, 0, 0);

describe('repository selection', () => {
  afterEach(() => {
    deactivateDemo();
    jest.clearAllMocks();
  });

  describe('when demo mode is active', () => {
    beforeEach(() => activateDemo(REF));

    it('serves transactions from the in-memory store, never Supabase', async () => {
      const txs = await transactionsRepo.fetch();
      expect(txs.length).toBeGreaterThan(0); // seeded demo data
      expect(transactionsService.fetchTransactions).not.toHaveBeenCalled();

      await transactionsRepo.create({
        amount: 1,
        merchant: 'x',
        category: 'Other',
        date: REF.toISOString(),
      });
      await transactionsRepo.update({ id: txs[0].id, amount: 2 });
      await transactionsRepo.remove(txs[0].id);
      expect(transactionsService.createTransaction).not.toHaveBeenCalled();
      expect(transactionsService.updateTransaction).not.toHaveBeenCalled();
      expect(transactionsService.deleteTransaction).not.toHaveBeenCalled();
    });

    it('serves budgets and recurring from the store, never Supabase', async () => {
      await budgetsRepo.fetchOne('2026-06');
      await budgetsRepo.fetchAll();
      await budgetsRepo.upsert({ monthKey: '2026-06', limit: 100 });
      await recurringRepo.fetch();
      await recurringRepo.confirm({
        merchant: 'Adobe',
        normalizedMerchant: 'adobe',
        expectedAmount: 54.99,
        frequency: 'monthly',
      });

      expect(budgetsService.fetchBudget).not.toHaveBeenCalled();
      expect(budgetsService.fetchBudgets).not.toHaveBeenCalled();
      expect(budgetsService.upsertBudget).not.toHaveBeenCalled();
      expect(recurringService.fetchRecurringExpenses).not.toHaveBeenCalled();
      expect(recurringService.confirmRecurring).not.toHaveBeenCalled();
    });
  });

  describe('when demo mode is inactive (real user)', () => {
    it('routes transactions to the real service', async () => {
      await transactionsRepo.fetch();
      expect(transactionsService.fetchTransactions).toHaveBeenCalledTimes(1);
    });

    it('routes budgets and recurring to the real service', async () => {
      await budgetsRepo.fetchOne('2026-06');
      await recurringRepo.fetch();
      expect(budgetsService.fetchBudget).toHaveBeenCalledTimes(1);
      expect(recurringService.fetchRecurringExpenses).toHaveBeenCalledTimes(1);
    });
  });
});
