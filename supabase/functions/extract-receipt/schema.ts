import { z } from 'npm:zod@^4';

/** Ledger's fixed category set — must stay in sync with the client. */
export const CATEGORIES = [
  'Groceries',
  'Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Health',
  'Bills',
  'Travel',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
});

/** Strict shape the AI must return. Everything nullable — never invent data. */
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

const CATEGORY_SET = new Set<string>(CATEGORIES);

// Common merchant/context words the model may return → a Ledger category.
const SYNONYMS: Record<string, Category> = {
  coffee: 'Dining',
  cafe: 'Dining',
  restaurant: 'Dining',
  'fast food': 'Dining',
  food: 'Dining',
  supermarket: 'Groceries',
  grocery: 'Groceries',
  gas: 'Transport',
  fuel: 'Transport',
  rideshare: 'Transport',
  taxi: 'Transport',
  parking: 'Transport',
  pharmacy: 'Health',
  medical: 'Health',
  utilities: 'Bills',
  utility: 'Bills',
  subscription: 'Subscriptions',
  streaming: 'Subscriptions',
  hotel: 'Travel',
  flight: 'Travel',
  airline: 'Travel',
  movie: 'Entertainment',
  entertainment: 'Entertainment',
  retail: 'Shopping',
  clothing: 'Shopping',
};

/** Map an arbitrary AI suggestion onto the fixed category set; default Other. */
export function normalizeCategory(raw: string | null | undefined): Category {
  if (!raw) return 'Other';
  const trimmed = raw.trim();
  if (CATEGORY_SET.has(trimmed)) return trimmed as Category;
  const lower = trimmed.toLowerCase();
  for (const [word, category] of Object.entries(SYNONYMS)) {
    if (lower.includes(word)) return category;
  }
  return 'Other';
}
