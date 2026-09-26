/// <reference types="jest" />
import type { Transaction } from '@/types/transaction';
import {
  formValuesToCreateInput,
  formValuesToUpdateInput,
  transactionFormSchema,
  transactionToFormValues,
  type TransactionFormValues,
} from '@/features/transactions/schema';

const validValues: TransactionFormValues = {
  amount: '18.40',
  merchant: '  Chipotle  ',
  category: 'Dining',
  date: new Date('2026-09-24T13:42:00'),
  note: '   ',
};

describe('transactionFormSchema', () => {
  it('accepts a valid form', () => {
    const result = transactionFormSchema.safeParse({ ...validValues, note: 'lunch' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive amount', () => {
    const result = transactionFormSchema.safeParse({ ...validValues, amount: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing merchant', () => {
    const result = transactionFormSchema.safeParse({ ...validValues, merchant: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    const result = transactionFormSchema.safeParse({ ...validValues, category: 'Nope' });
    expect(result.success).toBe(false);
  });
});

describe('form mapping', () => {
  it('maps form values to a create input', () => {
    const input = formValuesToCreateInput(validValues);
    expect(input.amount).toBe(18.4);
    expect(input.merchant).toBe('Chipotle');
    expect(input.category).toBe('Dining');
    expect(input.note).toBeUndefined(); // blank note dropped
    expect(input.sourceType).toBe('manual');
    expect(input.date).toBe(new Date('2026-09-24T13:42:00').toISOString());
  });

  it('maps form values to an update input with id', () => {
    const input = formValuesToUpdateInput('tx-1', { ...validValues, note: 'lunch' });
    expect(input.id).toBe('tx-1');
    expect(input.amount).toBe(18.4);
    expect(input.note).toBe('lunch');
  });

  it('prefills a form from a transaction', () => {
    const transaction: Transaction = {
      id: 'tx-1',
      amount: 47.82,
      currency: 'USD',
      merchant: 'Trader Joe’s',
      category: 'Groceries',
      date: '2026-09-24T09:34:00.000Z',
      sourceType: 'manual',
    };
    const values = transactionToFormValues(transaction);
    expect(values.amount).toBe('47.82');
    expect(values.category).toBe('Groceries');
    expect(values.note).toBe('');
    expect(values.date).toBeInstanceOf(Date);
  });

  it('falls back to Other for an unknown stored category', () => {
    const transaction: Transaction = {
      id: 'tx-2',
      amount: 5,
      currency: 'USD',
      merchant: 'X',
      category: 'LegacyCategory',
      date: '2026-09-24T09:34:00.000Z',
      sourceType: 'manual',
    };
    expect(transactionToFormValues(transaction).category).toBe('Other');
  });
});
