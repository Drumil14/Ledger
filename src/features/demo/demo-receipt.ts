/**
 * Sample receipt for demo mode.
 *
 * Lets a recruiter experience Ledger's receipt flow end-to-end without a camera,
 * a physical receipt, or any network/AI cost. The data mirrors exactly what the
 * real `extract-receipt` Edge Function returns (`ReceiptExtraction`), so it feeds
 * the *same* review UI and mapping (`receiptToFormValues`) as a real scan — no
 * special demo review screen. The transaction date is generated relative to now
 * so the resulting expense always lands in the current month.
 *
 * This is never used in real mode: the extraction path only reaches here when
 * demo mode is active.
 */

import type { ReceiptExtraction } from '@/features/receipts/schema';

/** How long the demo "processing" state lingers, for a believable beat. */
export const DEMO_RECEIPT_PROCESSING_MS = 1600;

function todayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A realistic Whole Foods grocery receipt. High confidence across the board so
 * the review screen shows a clean, confirmed-looking result.
 */
export function sampleReceiptExtraction(now: Date = new Date()): ReceiptExtraction {
  return {
    merchant: 'Whole Foods Market',
    total: 42.68,
    currency: 'USD',
    transactionDate: todayKey(now),
    categorySuggestion: 'Groceries',
    tax: 2.14,
    tip: null,
    lineItems: [
      { name: 'Organic bananas', quantity: 1, price: 1.99 },
      { name: 'Whole milk', quantity: 1, price: 4.49 },
      { name: 'Sourdough loaf', quantity: 1, price: 5.99 },
      { name: 'Free-range eggs', quantity: 1, price: 6.29 },
      { name: 'Chicken breast', quantity: 1, price: 12.4 },
      { name: 'Baby spinach', quantity: 1, price: 3.99 },
      { name: 'Sparkling water', quantity: 2, price: 3.7 },
    ],
    confidence: { merchant: 0.98, total: 0.97, date: 0.95 },
  };
}
