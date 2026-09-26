/// <reference types="jest" />
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { extractReceipt, ReceiptError } from '@/services/receipts';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { getUser: jest.fn() },
    storage: { from: jest.fn() },
  },
}));

const invoke = supabase.functions.invoke as unknown as jest.Mock;

const validExtraction = {
  merchant: "Trader Joe's",
  total: 47.82,
  currency: 'USD',
  transactionDate: '2026-09-24',
  categorySuggestion: 'Groceries',
  tax: null,
  tip: null,
  lineItems: null,
  confidence: null,
};

beforeEach(() => jest.clearAllMocks());

describe('extractReceipt', () => {
  it('returns the validated extraction on success', async () => {
    invoke.mockResolvedValue({ data: { extraction: validExtraction }, error: null });
    const result = await extractReceipt({ base64: 'x', mediaType: 'image/jpeg' });
    expect(result.merchant).toBe("Trader Joe's");
    expect(invoke).toHaveBeenCalledWith('extract-receipt', {
      body: { imageBase64: 'x', mediaType: 'image/jpeg' },
    });
  });

  it('throws failed when the response is malformed', async () => {
    invoke.mockResolvedValue({ data: { extraction: { merchant: "Trader Joe's" } }, error: null });
    await expect(extractReceipt({ base64: 'x', mediaType: 'image/jpeg' })).rejects.toMatchObject({
      code: 'failed',
    });
  });

  it('maps a network failure to offline', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('net')) });
    await expect(extractReceipt({ base64: 'x', mediaType: 'image/jpeg' })).rejects.toMatchObject({
      code: 'offline',
    });
  });

  it('maps a rate-limit response to rate_limited', async () => {
    const context = { json: async () => ({ error: 'rate_limited' }) };
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(context) });
    await expect(extractReceipt({ base64: 'x', mediaType: 'image/jpeg' })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('throws a ReceiptError for unknown http errors', async () => {
    const context = { json: async () => ({ error: 'extraction_failed' }) };
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(context) });
    const error = await extractReceipt({ base64: 'x', mediaType: 'image/jpeg' }).catch((e) => e);
    expect(error).toBeInstanceOf(ReceiptError);
    expect(error.code).toBe('failed');
  });
});
