/// <reference types="jest" />
import {
  incomeFormSchema,
  incomeFormToCreateInput,
  incomeFormToUpdateInput,
  incomeToFormValues,
  isEditableSchedule,
  type IncomeFormValues,
} from '@/features/income/schema';
import type { IncomeSource } from '@/types/income';

const customRecord: IncomeSource = {
  id: 'custom1',
  name: 'Gigs',
  amountCents: 50000,
  currency: 'USD',
  schedule: { kind: 'custom', dates: ['2026-03-01', '2026-05-01'] },
  startDate: '2026-03-01',
  endDate: null,
  active: true,
};

const monthlyRecord: IncomeSource = {
  id: 'm1',
  name: 'Salary',
  amountCents: 240000,
  currency: 'USD',
  schedule: { kind: 'monthly', dayOfMonth: 15 },
  startDate: '2026-02-15',
  endDate: null,
  active: true,
};

const valid: IncomeFormValues = {
  name: 'Paycheck',
  amount: '2400',
  frequency: 'monthly',
  date: new Date(2026, 0, 31),
  active: true,
};

describe('incomeFormSchema', () => {
  it('accepts a valid form', () => {
    expect(incomeFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(incomeFormSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
  });

  it('rejects a non-positive or malformed amount', () => {
    expect(incomeFormSchema.safeParse({ ...valid, amount: '0' }).success).toBe(false);
    expect(incomeFormSchema.safeParse({ ...valid, amount: 'abc' }).success).toBe(false);
  });

  it('rejects an unsupported frequency', () => {
    expect(incomeFormSchema.safeParse({ ...valid, frequency: 'quarterly' }).success).toBe(false);
  });
});

describe('incomeFormToCreateInput', () => {
  it('maps monthly with a day-of-month derived from the date', () => {
    expect(incomeFormToCreateInput(valid)).toEqual({
      name: 'Paycheck',
      amountCents: 240000,
      currency: 'USD',
      frequency: 'monthly',
      startDate: '2026-01-31',
      active: true,
      dayOfMonth: 31,
    });
  });

  it('maps weekly without a day-of-month, using the date as the anchor', () => {
    const input = incomeFormToCreateInput({
      ...valid,
      frequency: 'weekly',
      date: new Date(2026, 0, 5),
    });
    expect(input).toEqual({
      name: 'Paycheck',
      amountCents: 240000,
      currency: 'USD',
      frequency: 'weekly',
      startDate: '2026-01-05',
      active: true,
    });
    expect('dayOfMonth' in input).toBe(false);
  });
});

describe('incomeToFormValues', () => {
  it('round-trips a monthly record', () => {
    const record: IncomeSource = {
      id: 'i',
      name: 'Salary',
      amountCents: 240000,
      currency: 'USD',
      schedule: { kind: 'monthly', dayOfMonth: 15 },
      startDate: '2026-02-15',
      endDate: null,
      active: true,
    };
    const values = incomeToFormValues(record);
    expect(values.name).toBe('Salary');
    expect(values.amount).toBe('2400.00');
    expect(values.frequency).toBe('monthly');
    expect(values.date.getFullYear()).toBe(2026);
    expect(values.date.getDate()).toBe(15);
    expect(values.active).toBe(true);
  });

  it('falls back a custom schedule to one-time (display only)', () => {
    expect(incomeToFormValues(customRecord).frequency).toBe('one-time');
    expect(incomeToFormValues(customRecord).active).toBe(true);
  });
});

describe('isEditableSchedule', () => {
  it('treats custom schedules as not editable, others as editable', () => {
    expect(isEditableSchedule(customRecord)).toBe(false);
    expect(isEditableSchedule(monthlyRecord)).toBe(true);
  });
});

describe('incomeFormToUpdateInput', () => {
  it('preserves a custom schedule — only name, amount and status change', () => {
    const values: IncomeFormValues = {
      name: 'Gigs renamed',
      amount: '750',
      frequency: 'one-time', // display fallback; must be ignored
      date: new Date(2026, 0, 1),
      active: false,
    };
    const update = incomeFormToUpdateInput(values, customRecord);
    expect(update).toEqual({
      id: 'custom1',
      name: 'Gigs renamed',
      amountCents: 75000,
      currency: 'USD',
      active: false,
    });
    // Critically, none of the schedule columns are touched.
    expect('frequency' in update).toBe(false);
    expect('startDate' in update).toBe(false);
    expect('customDates' in update).toBe(false);
    expect('dayOfMonth' in update).toBe(false);
  });

  it('clears stale cadence fields when changing an editable schedule', () => {
    const values: IncomeFormValues = {
      name: 'Salary',
      amount: '2400',
      frequency: 'weekly', // monthly → weekly
      date: new Date(2026, 0, 5),
      active: true,
    };
    const update = incomeFormToUpdateInput(values, monthlyRecord);
    expect(update).toMatchObject({
      id: 'm1',
      frequency: 'weekly',
      startDate: '2026-01-05',
      dayOfMonth: null, // the old monthly day must be cleared
      customDates: null,
    });
  });
});
