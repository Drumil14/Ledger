/// <reference types="jest" />
import {
  receiptExtractionSchema,
  receiptLineItems,
  receiptToFormValues,
  uncertainFields,
  uncertaintyMessage,
  type ReceiptExtraction,
} from '@/features/receipts/schema';
import { formValuesToCreateInput } from '@/features/transactions/schema';

const base: ReceiptExtraction = {
  merchant: "Trader Joe's",
  total: 47.82,
  currency: 'USD',
  transactionDate: '2026-09-24',
  categorySuggestion: 'Groceries',
  tax: 2.83,
  tip: null,
  lineItems: [{ name: 'Chicken', quantity: 1, price: 12.49 }],
  confidence: { merchant: 0.97, total: 0.99, date: 0.91 },
};

describe('receiptExtractionSchema', () => {
  it('accepts a well-formed extraction', () => {
    expect(receiptExtractionSchema.safeParse(base).success).toBe(true);
  });

  it('accepts all-null fields (nothing invented)', () => {
    const empty = {
      merchant: null,
      total: null,
      currency: null,
      transactionDate: null,
      categorySuggestion: null,
      tax: null,
      tip: null,
      lineItems: null,
      confidence: null,
    };
    expect(receiptExtractionSchema.safeParse(empty).success).toBe(true);
  });

  it('rejects malformed responses', () => {
    expect(receiptExtractionSchema.safeParse({ merchant: "Trader Joe's" }).success).toBe(false);
    expect(receiptExtractionSchema.safeParse({ ...base, total: 'lots' }).success).toBe(false);
    expect(receiptExtractionSchema.safeParse('not json').success).toBe(false);
  });
});

describe('receiptToFormValues', () => {
  it('maps a clean extraction', () => {
    const values = receiptToFormValues(base);
    expect(values.amount).toBe('47.82');
    expect(values.merchant).toBe("Trader Joe's");
    expect(values.category).toBe('Groceries');
    expect(values.date.getFullYear()).toBe(2026);
    expect(values.date.getMonth()).toBe(8); // September (0-indexed)
    expect(values.date.getDate()).toBe(24);
  });

  it('falls back to Other for an invented category', () => {
    expect(receiptToFormValues({ ...base, categorySuggestion: 'Coffee' }).category).toBe('Other');
    expect(receiptToFormValues({ ...base, categorySuggestion: null }).category).toBe('Other');
  });

  it('blanks the amount when total is missing or non-positive', () => {
    expect(receiptToFormValues({ ...base, total: null }).amount).toBe('');
    expect(receiptToFormValues({ ...base, total: 0 }).amount).toBe('');
  });

  it('defaults the date to today when missing or unparseable', () => {
    expect(receiptToFormValues({ ...base, transactionDate: null }).date).toBeInstanceOf(Date);
    expect(receiptToFormValues({ ...base, transactionDate: 'not-a-date' }).date).toBeInstanceOf(Date);
  });
});

describe('receiptLineItems', () => {
  it('drops empty names and returns undefined when none', () => {
    expect(receiptLineItems({ ...base, lineItems: [{ name: '  ' }] })).toBeUndefined();
    expect(receiptLineItems({ ...base, lineItems: null })).toBeUndefined();
    expect(receiptLineItems(base)).toEqual([{ name: 'Chicken', quantity: 1, price: 12.49 }]);
  });
});

describe('uncertainty', () => {
  it('flags low-confidence and missing fields', () => {
    expect(uncertainFields(base)).toEqual([]);
    expect(uncertainFields({ ...base, transactionDate: null })).toContain('date');
    expect(uncertainFields({ ...base, confidence: { merchant: 0.4, total: 0.99, date: 0.99 } })).toEqual([
      'merchant',
    ]);
  });

  it('phrases a calm message', () => {
    expect(uncertaintyMessage([])).toBeNull();
    expect(uncertaintyMessage(['date'])).toBe('Double-check the date.');
    expect(uncertaintyMessage(['merchant', 'date'])).toBe('Double-check the merchant and date.');
  });
});

describe('confirmation → transaction mapping', () => {
  it('produces a create input from an extraction', () => {
    const input = formValuesToCreateInput(receiptToFormValues(base));
    expect(input.amount).toBe(47.82);
    expect(input.merchant).toBe("Trader Joe's");
    expect(input.category).toBe('Groceries');
    expect(typeof input.date).toBe('string'); // ISO
  });
});
