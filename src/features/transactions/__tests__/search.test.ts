/// <reference types="jest" />
import {
  ALL_FILTER,
  filterTransactions,
  groupTransactionsByDate,
  toListItems,
} from '@/features/transactions/search';
import type { Transaction } from '@/types/transaction';

const now = new Date('2026-09-24T12:00:00');

const make = (
  id: string,
  date: string,
  merchant: string,
  category: string,
  note?: string
): Transaction => ({
  id,
  date,
  merchant,
  category,
  note,
  amount: 10,
  currency: 'USD',
  sourceType: 'manual',
});

const transactions: Transaction[] = [
  make('t1', '2026-09-24T09:34:00', 'Chipotle', 'Dining', 'lunch'),
  make('t2', '2026-09-23T20:14:00', 'Uber', 'Transport'),
  make('t3', '2026-09-20T10:00:00', 'Trader Joe’s', 'Groceries'),
];

describe('filterTransactions', () => {
  it('matches merchant, category and note', () => {
    expect(filterTransactions(transactions, { search: 'chip' }).map((t) => t.id)).toEqual(['t1']);
    expect(filterTransactions(transactions, { search: 'grocer' }).map((t) => t.id)).toEqual(['t3']);
    expect(filterTransactions(transactions, { search: 'lunch' }).map((t) => t.id)).toEqual(['t1']);
  });

  it('filters by category and passes through All', () => {
    expect(filterTransactions(transactions, { category: 'Dining' }).map((t) => t.id)).toEqual(['t1']);
    expect(filterTransactions(transactions, { category: ALL_FILTER })).toHaveLength(3);
  });
});

describe('groupTransactionsByDate', () => {
  it('labels and orders groups newest first', () => {
    const groups = groupTransactionsByDate(transactions, now);
    expect(groups.map((g) => g.label)).toEqual(['TODAY', 'YESTERDAY', 'SEP 20']);
    expect(groups[0].data[0].id).toBe('t1');
  });
});

describe('toListItems', () => {
  it('interleaves headers and rows', () => {
    const items = toListItems(groupTransactionsByDate(transactions, now));
    expect(items).toHaveLength(6);
    expect(items[0]).toMatchObject({ type: 'header', label: 'TODAY' });
    expect(items[1]).toMatchObject({ type: 'row' });
  });
});
