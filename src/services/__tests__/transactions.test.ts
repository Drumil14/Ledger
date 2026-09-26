/// <reference types="jest" />
import { SESSION_EXPIRED } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '@/services/transactions';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

type Result = { data: unknown; error: unknown };

interface Builder {
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: Result) => void) => void;
}

function makeBuilder(result: Result): Builder {
  const builder = {} as Builder;
  builder.insert = jest.fn(() => builder);
  builder.update = jest.fn(() => builder);
  builder.delete = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve) => resolve(result);
  return builder;
}

const mockedFrom = supabase.from as unknown as jest.Mock;
const mockedGetUser = supabase.auth.getUser as unknown as jest.Mock;

const row = {
  id: 'r1',
  user_id: 'u1',
  amount: '47.82',
  currency: 'USD',
  merchant: 'Trader Joe’s',
  category: 'Groceries',
  transaction_date: '2026-09-24T09:34:00.000Z',
  note: null,
  source_type: 'manual',
  created_at: '2026-09-24T09:34:00.000Z',
  updated_at: '2026-09-24T09:34:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('fetchTransactions', () => {
  it('maps rows (string numeric → number, null note → undefined)', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: [row], error: null }));
    const result = await fetchTransactions();
    expect(mockedFrom).toHaveBeenCalledWith('transactions');
    expect(result[0]).toMatchObject({ id: 'r1', amount: 47.82, note: undefined });
  });

  it('throws the backend message on error', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    await expect(fetchTransactions()).rejects.toThrow('boom');
  });
});

describe('createTransaction', () => {
  it('inserts with the user_id from the session', async () => {
    const builder = makeBuilder({ data: row, error: null });
    mockedFrom.mockReturnValue(builder);

    const result = await createTransaction({
      amount: 47.82,
      merchant: 'Trader Joe’s',
      category: 'Groceries',
      date: '2026-09-24T09:34:00.000Z',
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', source_type: 'manual', amount: 47.82 })
    );
    expect(result.id).toBe('r1');
  });

  it('rejects when there is no session', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      createTransaction({ amount: 1, merchant: 'x', category: 'Other', date: 'd' })
    ).rejects.toThrow(SESSION_EXPIRED);
  });
});

describe('updateTransaction', () => {
  it('updates the changed fields and targets the id', async () => {
    const builder = makeBuilder({ data: row, error: null });
    mockedFrom.mockReturnValue(builder);

    await updateTransaction({ id: 'r1', amount: 50, merchant: 'New' });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, merchant: 'New' })
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });
});

describe('deleteTransaction', () => {
  it('deletes by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockedFrom.mockReturnValue(builder);

    await deleteTransaction('r1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('throws on delete error', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'nope' } }));
    await expect(deleteTransaction('r1')).rejects.toThrow('nope');
  });
});
