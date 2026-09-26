/// <reference types="jest" />
import { supabase } from '@/lib/supabase';
import { deleteBudget, fetchBudget, fetchBudgets, upsertBudget } from '@/services/budgets';

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
  maybeSingle: jest.Mock;
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
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve) => resolve(result);
  return builder;
}

const mockedFrom = supabase.from as unknown as jest.Mock;
const mockedGetUser = supabase.auth.getUser as unknown as jest.Mock;

const row = {
  id: 'b1',
  user_id: 'u1',
  month: '2026-09-01',
  limit_amount: '2500.00',
  currency: 'USD',
  created_at: 'x',
  updated_at: 'y',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('fetchBudget', () => {
  it('maps a row and queries the first-of-month date', () => {
    const builder = makeBuilder({ data: row, error: null });
    mockedFrom.mockReturnValue(builder);
    return fetchBudget('2026-09').then((budget) => {
      expect(builder.eq).toHaveBeenCalledWith('month', '2026-09-01');
      expect(budget).toEqual({ id: 'b1', month: '2026-09-01', limit: 2500, currency: 'USD' });
    });
  });

  it('returns null when no budget exists', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: null, error: null }));
    expect(await fetchBudget('2026-09')).toBeNull();
  });
});

describe('fetchBudgets', () => {
  it('maps all rows', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: [row], error: null }));
    const budgets = await fetchBudgets();
    expect(budgets).toHaveLength(1);
    expect(budgets[0].limit).toBe(2500);
  });
});

describe('upsertBudget', () => {
  it('upserts with the session user and prevents duplicate months via onConflict', async () => {
    const builder = makeBuilder({ data: row, error: null });
    mockedFrom.mockReturnValue(builder);

    const budget = await upsertBudget({ monthKey: '2026-09', limit: 2500 });

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', month: '2026-09-01', limit_amount: 2500 }),
      { onConflict: 'user_id,month' }
    );
    expect(budget.limit).toBe(2500);
  });
});

describe('deleteBudget', () => {
  it('deletes the month for the current user', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockedFrom.mockReturnValue(builder);
    await deleteBudget('2026-09');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('month', '2026-09-01');
  });
});
