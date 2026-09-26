/// <reference types="jest" />
import { budgetFormSchema, budgetFormToLimit } from '@/features/budgets/schema';

describe('budgetFormSchema', () => {
  it('accepts valid budgets', () => {
    expect(budgetFormSchema.safeParse({ amount: '2500' }).success).toBe(true);
    expect(budgetFormSchema.safeParse({ amount: '2500.50' }).success).toBe(true);
  });

  it('rejects invalid budgets', () => {
    expect(budgetFormSchema.safeParse({ amount: '0' }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ amount: '-2500' }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ amount: '12.3.4' }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ amount: 'abc' }).success).toBe(false);
    expect(budgetFormSchema.safeParse({ amount: '' }).success).toBe(false);
  });
});

describe('budgetFormToLimit', () => {
  it('converts a validated form to a dollar amount', () => {
    expect(budgetFormToLimit({ amount: '2500' })).toBe(2500);
    expect(budgetFormToLimit({ amount: '2500.5' })).toBe(2500.5);
  });
});
