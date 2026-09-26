/// <reference types="jest" />
import {
  computeAnnualEstimate,
  computeMonthlyRecurringTotal,
  describeAmount,
  frequencyAdverb,
  frequencyLabel,
  generateRecurringInsights,
  intervalPhrase,
  monthlyEquivalentCents,
  type RecurringAmount,
} from '@/features/recurring/summary';

describe('computeMonthlyRecurringTotal', () => {
  it('sums monthly subscriptions without float drift', () => {
    const items: RecurringAmount[] = [
      { expectedAmount: 11.99, frequency: 'monthly' },
      { expectedAmount: 22.99, frequency: 'monthly' },
      { expectedAmount: 49.0, frequency: 'monthly' },
      { expectedAmount: 2.99, frequency: 'monthly' },
    ];
    // 11.99 + 22.99 + 49.00 + 2.99 = 86.97 (exact cents, no float drift)
    expect(computeMonthlyRecurringTotal(items)).toBe(86.97);
  });

  it('ignores items without a captured amount', () => {
    const items: RecurringAmount[] = [
      { expectedAmount: null, frequency: 'monthly' },
      { expectedAmount: 10, frequency: 'monthly' },
    ];
    expect(computeMonthlyRecurringTotal(items)).toBe(10);
  });

  it('normalizes non-monthly frequencies to a monthly equivalent', () => {
    // yearly $120 ⇒ $10/mo, weekly $10 ⇒ ~$43.33/mo
    const items: RecurringAmount[] = [
      { expectedAmount: 120, frequency: 'yearly' },
      { expectedAmount: 30, frequency: 'quarterly' },
    ];
    // 120/12 = 10.00, 30/3 = 10.00
    expect(computeMonthlyRecurringTotal(items)).toBe(20);
  });
});

describe('monthlyEquivalentCents', () => {
  it('scales each frequency to a monthly figure', () => {
    expect(monthlyEquivalentCents(1000, 'monthly')).toBe(1000);
    expect(monthlyEquivalentCents(1200, 'yearly')).toBe(100);
    expect(monthlyEquivalentCents(3000, 'quarterly')).toBe(1000);
    expect(monthlyEquivalentCents(1000, 'weekly')).toBe(Math.round((1000 * 52) / 12));
    expect(monthlyEquivalentCents(1000, 'biweekly')).toBe(Math.round((1000 * 26) / 12));
  });
});

describe('computeAnnualEstimate', () => {
  it('is the monthly total times twelve', () => {
    expect(computeAnnualEstimate(86.96)).toBe(1043.52);
  });
});

describe('generateRecurringInsights', () => {
  const items = [
    { merchant: 'Spotify', expectedAmount: 11.99, frequency: 'monthly' as const },
    { merchant: 'Netflix', expectedAmount: 22.99, frequency: 'monthly' as const },
  ];

  it('states the confirmed monthly total descriptively', () => {
    const insights = generateRecurringInsights(items, 'USD');
    expect(insights[0].text).toBe(
      'You have $34.98 in confirmed monthly recurring expenses.'
    );
  });

  it('summarizes the annual estimate when there are multiple items', () => {
    const insights = generateRecurringInsights(items, 'USD');
    expect(insights.some((i) => i.id === 'recurring-annual')).toBe(true);
    expect(insights[1].text).toContain('per year at their current rates');
  });

  it('never recommends or advises — only describes', () => {
    const insights = generateRecurringInsights(items, 'USD');
    for (const insight of insights) {
      expect(insight.text.toLowerCase()).not.toContain('should');
      expect(insight.text.toLowerCase()).not.toContain('cancel');
    }
  });

  it('returns nothing when there are no confirmed items', () => {
    expect(generateRecurringInsights([], 'USD')).toEqual([]);
  });
});

describe('copy helpers', () => {
  it('describes amounts for screen readers', () => {
    expect(describeAmount(22.99)).toBe('22 dollars and 99 cents');
    expect(describeAmount(49)).toBe('49 dollars');
    expect(describeAmount(1.01)).toBe('1 dollar and 1 cent');
  });

  it('labels frequencies', () => {
    expect(frequencyLabel('monthly')).toBe('Monthly');
    expect(intervalPhrase('monthly')).toBe('about one month apart');
    expect(frequencyAdverb('monthly')).toBe('approximately monthly');
  });
});
