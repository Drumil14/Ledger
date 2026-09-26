/** Spending categories. Monochrome only — never mapped to colour. */
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

export const DEFAULT_CATEGORY: Category = 'Other';

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
