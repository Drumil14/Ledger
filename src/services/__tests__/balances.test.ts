/// <reference types="jest" />
import { supabase } from '@/lib/supabase';
import {
  deleteBalanceSnapshot,
  fetchBalanceSnapshots,
  upsertBalanceSnapshot,
} from '@/services/balances';

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
  id: 'bal1',
  user_id: 'u1',
  amount_cents: '420000',
  currency: 'USD',
  effective_date: '2026-06-01',
  created_at: 'x',
  updated_at: 'y',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('fetchBalanceSnapshots', () => {
  it('maps rows with exact cents and orders by effective date desc', async () => {
    const builder = makeBuilder({ data: [row], error: null });
    mockedFrom.mockReturnValue(builder);
    const [snapshot] = await fetchBalanceSnapshots();
    expect(builder.order).toHaveBeenCalledWith('effective_date', { ascending: false });
    expect(snapshot).toEqual({
      id: 'bal1',
      amountCents: 420000,
      currency: 'USD',
      effectiveDate: '2026-06-01',
    });
  });
});

describe('upsertBalanceSnapshot', () => {
  it('upserts with the session user and one-per-date conflict key', async () => {
    const builder = makeBuilder({ data: row, error: null });
    mockedFrom.mockReturnValue(builder);

    const saved = await upsertBalanceSnapshot({ amountCents: 420000, effectiveDate: '2026-06-01' });
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', amount_cents: 420000, effective_date: '2026-06-01' }),
      { onConflict: 'user_id,effective_date' }
    );
    expect(saved.amountCents).toBe(420000);
  });

  it('preserves a negative (overdraft) balance', async () => {
    const builder = makeBuilder({ data: { ...row, amount_cents: '-5000' }, error: null });
    mockedFrom.mockReturnValue(builder);
    const saved = await upsertBalanceSnapshot({ amountCents: -5000, effectiveDate: '2026-06-01' });
    expect(saved.amountCents).toBe(-5000);
  });
});

describe('deleteBalanceSnapshot', () => {
  it('deletes by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockedFrom.mockReturnValue(builder);
    await deleteBalanceSnapshot('bal1');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'bal1');
  });
});
