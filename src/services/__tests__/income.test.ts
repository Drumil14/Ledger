/// <reference types="jest" />
import { supabase } from '@/lib/supabase';
import {
  createIncomeSource,
  deleteIncomeSource,
  fetchIncomeSources,
  updateIncomeSource,
} from '@/services/income';

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
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: Result) => void) => void;
}

function makeBuilder(result: Result): Builder {
  const builder = {} as Builder;
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.insert = jest.fn(() => builder);
  builder.update = jest.fn(() => builder);
  builder.delete = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve) => resolve(result);
  return builder;
}

const mockedFrom = supabase.from as unknown as jest.Mock;
const mockedGetUser = supabase.auth.getUser as unknown as jest.Mock;

const biweeklyRow = {
  id: 'inc1',
  user_id: 'u1',
  name: 'Paycheck',
  amount_cents: '240000', // bigint can arrive as a string
  currency: 'USD',
  frequency: 'biweekly',
  day_of_month: null,
  custom_dates: null,
  start_date: '2026-05-01',
  end_date: null,
  is_active: true,
  created_at: 'x',
  updated_at: 'y',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('fetchIncomeSources', () => {
  it('maps a biweekly row and reconstructs the schedule + exact cents', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: [biweeklyRow], error: null }));
    const [income] = await fetchIncomeSources();
    expect(income).toEqual({
      id: 'inc1',
      name: 'Paycheck',
      amountCents: 240000,
      currency: 'USD',
      schedule: { kind: 'biweekly', anchorDate: '2026-05-01' },
      startDate: '2026-05-01',
      endDate: null,
      active: true,
    });
  });

  it('reconstructs monthly and custom schedules from flat columns', async () => {
    mockedFrom.mockReturnValue(
      makeBuilder({
        data: [
          { ...biweeklyRow, frequency: 'monthly', day_of_month: 15 },
          { ...biweeklyRow, id: 'inc2', frequency: 'custom', custom_dates: ['2026-06-01', '2026-07-01'] },
        ],
        error: null,
      })
    );
    const [monthly, custom] = await fetchIncomeSources();
    expect(monthly.schedule).toEqual({ kind: 'monthly', dayOfMonth: 15 });
    expect(custom.schedule).toEqual({ kind: 'custom', dates: ['2026-06-01', '2026-07-01'] });
  });

  it('throws on a query error', async () => {
    mockedFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    await expect(fetchIncomeSources()).rejects.toThrow('boom');
  });
});

describe('createIncomeSource', () => {
  it('inserts the session user id and the mapped columns', async () => {
    const builder = makeBuilder({ data: biweeklyRow, error: null });
    mockedFrom.mockReturnValue(builder);

    const created = await createIncomeSource({
      name: 'Paycheck',
      amountCents: 240000,
      frequency: 'biweekly',
      startDate: '2026-05-01',
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        name: 'Paycheck',
        amount_cents: 240000,
        currency: 'USD',
        frequency: 'biweekly',
        start_date: '2026-05-01',
        is_active: true,
      })
    );
    expect(created.id).toBe('inc1');
  });

  it('never trusts the client for ownership (uses the session)', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    await expect(
      createIncomeSource({ name: 'x', amountCents: 1, frequency: 'weekly', startDate: '2026-01-01' })
    ).rejects.toThrow();
  });
});

describe('updateIncomeSource', () => {
  it('updates only the provided columns, scoped by id', async () => {
    const builder = makeBuilder({ data: { ...biweeklyRow, is_active: false }, error: null });
    mockedFrom.mockReturnValue(builder);

    const updated = await updateIncomeSource({ id: 'inc1', active: false });
    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
    expect(builder.eq).toHaveBeenCalledWith('id', 'inc1');
    expect(updated.active).toBe(false);
  });
});

describe('deleteIncomeSource', () => {
  it('deletes by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockedFrom.mockReturnValue(builder);
    await deleteIncomeSource('inc1');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'inc1');
  });
});
