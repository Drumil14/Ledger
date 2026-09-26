export type { Category } from '@/constants/categories';

/** How a transaction entered Ledger. */
export type SourceType = 'manual' | 'receipt' | 'import';

export type ReceiptLineItem = {
  name: string;
  quantity?: number | null;
  price?: number | null;
};

export type Transaction = {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  /** A `Category` in practice, typed as string so the backend can widen it. */
  category: string;
  /** ISO 8601 timestamp. */
  date: string;
  note?: string;
  sourceType: SourceType;
  /** Storage path of the receipt image (private bucket), if any. */
  receiptPath?: string;
  /** Extracted line items, if captured from a receipt. */
  receiptItems?: ReceiptLineItem[];
};

export type Budget = {
  id: string;
  /** Month in `YYYY-MM`. */
  month: string;
  limit: number;
  currency: string;
};
