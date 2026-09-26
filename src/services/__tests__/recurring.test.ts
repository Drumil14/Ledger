/// <reference types="jest" />
import { supabase } from '@/lib/supabase';
import {
  confirmRecurring,
  deleteRecurring,
  fetchRecurringExpenses,
  ignoreRecurring,
} from '@/services/recurring';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

type Result = { data: unknown; error: unknown };

interface Builder {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: Result) => void) => void;
}

function makeBuilder(result: Result): Builder {
  const builder = {} as Builder;
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.upsert = jest.fn(() => builder);
  builder.delete = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve) => resolve(result);
  return builder;
}

const mockedFrom = supabase.from as unknown as jest.Mock;
const mockedGetUser = supabase.auth.getUser as unknown as jest.Mock;

const row = {
  id: 'r1',
  user_id: 'u1',
  merchant: 'Spotify',
  normalized_merchant: 'spotify',
  expected_amount: '11.99',
  frequency: 'monthly',
  next_expected_date: '2026-10-14',
  status: 'confirmed',
  source: 'detected',
  last_transaction_id: 't9',
  last_detected_at: '2026-09-25T00:00:00Z',
  created_at: 'x',
  updated_at: 'y',
};

const input = {
  merchant: 'Spotify',
  normalizedMerchant: 'spotify',
  expectedAmount: 11.99,
  frequency: 'monthly' as const,
  nextExpectedDate: '2026-10-14',
  lastTransactionId: 't9',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('fetchRecurringExpenses', () => {
  it('maps rows and coerces the numeric amount', async () => {
    const builder = makeBuilder({ data: [row], error: null });
    mockedFrom.mockReturnValue(builder);

    const items = await fetchRecurringExpenses();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'r1',
      merchant: 'Spotify',
      normalizedMerchant: 'spotify',
      expectedAmount: 11.99,
      frequency: 'monthly',
      status: 'confirmed',
      source: 'detected',
      lastTransactionId: 't9',
    });
  });
});

describe('confirmRecurring', () => {
  it('upserts a confirmed decision scoped to the session user', async () => {
    const builder = makeBuilder({ data: row, error: null });
    mockedFrom.mockReturnValue(builder);

    await confirmRecurring(input);

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        normalized_merchant: 'spotify',
        expected_amount: 11.99,
        frequency: 'monthly',
        status: 'confirmed',
        source: 'detected',
      }),
      { onConflict: 'user_id,normalized_merchant,frequency' }
    );
  });
});

describe('ignoreRecurring', () => {
  it('upserts an ignored decision', async () => {
    const builder = makeBuilder({ data: { ...row, status: 'ignored' }, error: null });
    mockedFrom.mockReturnValue(builder);

    const result = await ignoreRecurring(input);

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ignored' }),
      { onConflict: 'user_id,normalized_merchant,frequency' }
    );
    expect(result.status).toBe('ignored');
  });
});

describe('deleteRecurring', () => {
  it('deletes by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockedFrom.mockReturnValue(builder);

    await deleteRecurring('r1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });
});
