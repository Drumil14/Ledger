import { z } from 'zod';

import { isCategory, type Category } from '@/constants/categories';
import { amountToInput } from '@/lib/money';
import type { ReceiptLineItem } from '@/types/transaction';
import type { TransactionFormValues } from '@/features/transactions/schema';

/** Mirrors the Edge Function's output. Validated again at the client boundary. */
const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
});

export const receiptExtractionSchema = z.object({
  merchant: z.string().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  transactionDate: z.string().nullable(),
  categorySuggestion: z.string().nullable(),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  lineItems: z.array(lineItemSchema).nullable(),
  confidence: z
    .object({
      merchant: z.number().nullable().optional(),
      total: z.number().nullable().optional(),
      date: z.number().nullable().optional(),
    })
    .nullable(),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

/** Response envelope from the extract-receipt function. */
export const extractResponseSchema = z.object({ extraction: receiptExtractionSchema });

function parseReceiptDate(value: string): Date {
  // Expect YYYY-MM-DD; fall back to today if unparseable.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return new Date();
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** Prefill the shared transaction form from an extraction. Money reuses the cents helpers. */
export function receiptToFormValues(extraction: ReceiptExtraction): TransactionFormValues {
  const category: Category =
    extraction.categorySuggestion && isCategory(extraction.categorySuggestion)
      ? extraction.categorySuggestion
      : 'Other';

  return {
    amount: extraction.total && extraction.total > 0 ? amountToInput(extraction.total) : '',
    merchant: extraction.merchant?.trim() ?? '',
    category,
    date: extraction.transactionDate ? parseReceiptDate(extraction.transactionDate) : new Date(),
    note: '',
  };
}

export function receiptLineItems(extraction: ReceiptExtraction): ReceiptLineItem[] | undefined {
  if (!extraction.lineItems || extraction.lineItems.length === 0) return undefined;
  const items = extraction.lineItems
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({ name: item.name.trim(), quantity: item.quantity, price: item.price }));
  return items.length > 0 ? items : undefined;
}

export type UncertainField = 'amount' | 'merchant' | 'date';

const LOW_CONFIDENCE = 0.7;

/** Fields the user should double-check (missing value or low model confidence). */
export function uncertainFields(extraction: ReceiptExtraction): UncertainField[] {
  const c = extraction.confidence ?? {};
  const fields: UncertainField[] = [];
  if (extraction.merchant == null || (c.merchant != null && c.merchant < LOW_CONFIDENCE)) {
    fields.push('merchant');
  }
  if (extraction.total == null || (c.total != null && c.total < LOW_CONFIDENCE)) {
    fields.push('amount');
  }
  if (extraction.transactionDate == null || (c.date != null && c.date < LOW_CONFIDENCE)) {
    fields.push('date');
  }
  return fields;
}

const LABELS: Record<UncertainField, string> = {
  amount: 'amount',
  merchant: 'merchant',
  date: 'date',
};

/** A calm, monochrome hint like "Double-check the date and merchant." */
export function uncertaintyMessage(fields: UncertainField[]): string | null {
  if (fields.length === 0) return null;
  const words = fields.map((f) => LABELS[f]);
  const list =
    words.length === 1
      ? words[0]
      : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return `Double-check the ${list}.`;
}
