/// <reference types="jest" />
import { receiptToFormValues } from '@/features/receipts/schema';
import { monthKeyFromDate } from '@/lib/month';

import { DEMO_RECEIPT_PROCESSING_MS, sampleReceiptExtraction } from '../demo-receipt';

const NOW = new Date(2026, 5, 26, 12, 0, 0);

describe('sample receipt', () => {
  it('returns a realistic, high-confidence extraction', () => {
    const extraction = sampleReceiptExtraction(NOW);
    expect(extraction.merchant).toBe('Whole Foods Market');
    expect(extraction.total).toBeGreaterThan(0);
    expect(extraction.categorySuggestion).toBe('Groceries');
    expect(extraction.lineItems?.length).toBeGreaterThan(0);
  });

  it('dates the sample in the current month so it lands in the demo month', () => {
    const extraction = sampleReceiptExtraction(NOW);
    expect(extraction.transactionDate).toBeTruthy();
    expect(monthKeyFromDate(new Date(extraction.transactionDate as string))).toBe(
      monthKeyFromDate(NOW)
    );
  });

  it('maps cleanly through the SAME review mapping a real scan uses', () => {
    const extraction = sampleReceiptExtraction(NOW);
    const values = receiptToFormValues(extraction);
    expect(values.merchant).toBe('Whole Foods Market');
    expect(values.category).toBe('Groceries');
    expect(values.amount).toBe('42.68');
    expect(monthKeyFromDate(values.date)).toBe(monthKeyFromDate(NOW));
  });

  it('exposes a processing delay for a believable beat', () => {
    expect(DEMO_RECEIPT_PROCESSING_MS).toBeGreaterThan(0);
  });
});
