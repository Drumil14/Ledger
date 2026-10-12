/// <reference types="jest" />
import { balanceFormSchema, balanceFormToInput, type BalanceFormValues } from '@/features/balances/schema';

const valid: BalanceFormValues = {
  amount: '100.50',
  negative: false,
  date: new Date(2026, 0, 15),
};

describe('balanceFormSchema', () => {
  it('accepts a valid form', () => {
    expect(balanceFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty or malformed amount', () => {
    expect(balanceFormSchema.safeParse({ ...valid, amount: '' }).success).toBe(false);
    expect(balanceFormSchema.safeParse({ ...valid, amount: '12.3.4' }).success).toBe(false);
  });
});

describe('balanceFormToInput', () => {
  it('maps a positive balance to cents on its effective date', () => {
    expect(balanceFormToInput(valid)).toEqual({
      amountCents: 10050,
      currency: 'USD',
      effectiveDate: '2026-01-15',
    });
  });

  it('applies the negative (overdraft) sign deliberately', () => {
    expect(balanceFormToInput({ ...valid, negative: true }).amountCents).toBe(-10050);
  });
});
