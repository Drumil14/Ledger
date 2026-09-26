/// <reference types="jest" />
import {
  buildBudgetContent,
  buildRecurringContent,
  buildSummaryContent,
  budgetNotificationId,
  computeMonthlySummaryDate,
  computeRecurringReminderDate,
  getCrossedBudgetThreshold,
  recurringLeadPhrase,
  recurringNotificationId,
  routeForKind,
  routeForNotificationData,
  thresholdsSatisfied,
  REMINDER_HOUR,
  SUMMARY_NOTIFICATION_ID,
} from '@/features/notifications/scheduler';

/* -------------------------------------------------------------------------- */
/* Recurring reminder dates                                                   */
/* -------------------------------------------------------------------------- */

describe('computeRecurringReminderDate', () => {
  const parts = (d: Date) => ({
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
  });

  it('schedules 1 day before at 9 AM local', () => {
    expect(parts(computeRecurringReminderDate('2026-10-14', 1))).toEqual({
      y: 2026,
      m: 9,
      day: 13,
      hour: REMINDER_HOUR,
    });
  });

  it('schedules 3 and 7 days before', () => {
    expect(parts(computeRecurringReminderDate('2026-10-14', 3)).day).toBe(11);
    expect(parts(computeRecurringReminderDate('2026-10-14', 7)).day).toBe(7);
  });

  it('rolls back across a month boundary', () => {
    const d = computeRecurringReminderDate('2026-10-02', 7);
    expect(parts(d)).toEqual({ y: 2026, m: 8, day: 25, hour: REMINDER_HOUR });
  });
});

describe('recurringLeadPhrase', () => {
  it('uses "tomorrow" for 1 day and "in N days" otherwise', () => {
    expect(recurringLeadPhrase(1)).toBe('tomorrow');
    expect(recurringLeadPhrase(3)).toBe('in 3 days');
    expect(recurringLeadPhrase(7)).toBe('in 7 days');
  });
});

describe('buildRecurringContent', () => {
  it('uses expected language and the amount', () => {
    expect(buildRecurringContent({ merchant: 'Spotify', amount: 11.99, currency: 'USD', leadDays: 1 })).toEqual(
      { title: 'Spotify expected tomorrow', body: '$11.99' }
    );
    expect(buildRecurringContent({ merchant: 'Netflix', amount: 22.99, currency: 'USD', leadDays: 3 })).toEqual(
      { title: 'Netflix expected in 3 days', body: '$22.99' }
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Stable identifiers                                                         */
/* -------------------------------------------------------------------------- */

describe('notification ids', () => {
  it('are stable and deterministic', () => {
    expect(recurringNotificationId('abc')).toBe('ledger-recurring-abc');
    expect(recurringNotificationId('abc')).toBe(recurringNotificationId('abc'));
    expect(budgetNotificationId('2026-09', 75)).toBe('ledger-budget-2026-09-75');
    expect(SUMMARY_NOTIFICATION_ID).toBe('ledger-summary');
  });
});

/* -------------------------------------------------------------------------- */
/* Budget threshold engine                                                    */
/* -------------------------------------------------------------------------- */

describe('thresholdsSatisfied', () => {
  it('returns thresholds reached (inclusive)', () => {
    expect(thresholdsSatisfied(800, 1000)).toEqual([75]);
    expect(thresholdsSatisfied(900, 1000)).toEqual([75, 90]);
    expect(thresholdsSatisfied(1000, 1000)).toEqual([75, 90, 100]);
    expect(thresholdsSatisfied(1200, 1000)).toEqual([75, 90, 100]);
    expect(thresholdsSatisfied(750, 1000)).toEqual([75]); // exactly 75%
  });
});

describe('getCrossedBudgetThreshold', () => {
  const base = { budgetLimit: 1000, alreadyNotified: [] as number[] };

  it('detects a 75% crossing', () => {
    expect(
      getCrossedBudgetThreshold({ ...base, previousSpend: 730, currentSpend: 780 })
    ).toBe(75);
  });

  it('detects a 90% crossing', () => {
    expect(
      getCrossedBudgetThreshold({ ...base, previousSpend: 880, currentSpend: 910, alreadyNotified: [75] })
    ).toBe(90);
  });

  it('detects a 100% crossing', () => {
    expect(
      getCrossedBudgetThreshold({
        ...base,
        previousSpend: 980,
        currentSpend: 1010,
        alreadyNotified: [75, 90],
      })
    ).toBe(100);
  });

  it('returns the highest level when several are crossed at once', () => {
    expect(
      getCrossedBudgetThreshold({ ...base, previousSpend: 730, currentSpend: 1050 })
    ).toBe(100);
  });

  it('does not re-fire a threshold already crossed', () => {
    // 78% → 80%, still only in the 75% band, and 75% already fired
    expect(
      getCrossedBudgetThreshold({ ...base, previousSpend: 780, currentSpend: 800, alreadyNotified: [75] })
    ).toBeNull();
  });

  it('handles a budget edit: previous reset, only un-notified levels fire', () => {
    // Limit lowered so 90% is now satisfied; 75% already notified this month.
    expect(
      getCrossedBudgetThreshold({ ...base, previousSpend: 0, currentSpend: 950, alreadyNotified: [75] })
    ).toBe(90);
    // Nothing new after an edit that doesn't reach a new level.
    expect(
      getCrossedBudgetThreshold({ ...base, previousSpend: 0, currentSpend: 800, alreadyNotified: [75] })
    ).toBeNull();
  });

  it('returns null when there is no budget', () => {
    expect(
      getCrossedBudgetThreshold({ previousSpend: 0, currentSpend: 500, budgetLimit: 0, alreadyNotified: [] })
    ).toBeNull();
  });
});

describe('buildBudgetContent', () => {
  it('shows remaining below 100%', () => {
    expect(buildBudgetContent({ threshold: 75, monthName: 'September', remaining: 625, currency: 'USD' })).toEqual(
      { title: "You've used 75% of your September budget", body: '$625.00 remaining' }
    );
    expect(buildBudgetContent({ threshold: 90, monthName: 'September', remaining: 250, currency: 'USD' })).toEqual(
      { title: "You've used 90% of your September budget", body: '$250.00 remaining' }
    );
  });

  it('switches to "reached" at 100% and never shows negative remaining', () => {
    expect(buildBudgetContent({ threshold: 100, monthName: 'September', remaining: 0, currency: 'USD' })).toEqual(
      { title: "You've reached your September budget", body: '$0.00 remaining' }
    );
    expect(
      buildBudgetContent({ threshold: 100, monthName: 'September', remaining: -50, currency: 'USD' }).body
    ).toBe('$0.00 remaining');
  });
});

/* -------------------------------------------------------------------------- */
/* Monthly summary                                                            */
/* -------------------------------------------------------------------------- */

describe('computeMonthlySummaryDate', () => {
  it('is the first of next month at 9 AM local', () => {
    const d = computeMonthlySummaryDate(new Date(2026, 8, 25, 14, 30));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 1, REMINDER_HOUR]);
  });

  it('rolls over the year in December', () => {
    const d = computeMonthlySummaryDate(new Date(2026, 11, 15, 10, 0));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 0, 1, REMINDER_HOUR]);
  });
});

describe('buildSummaryContent', () => {
  it('reads calm and factual', () => {
    expect(buildSummaryContent({ monthName: 'September', spent: 1842.26, currency: 'USD' })).toEqual({
      title: 'September summary is ready',
      body: 'You spent $1,842.26 this month.',
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Deep-link mapping                                                          */
/* -------------------------------------------------------------------------- */

describe('deep-link routing', () => {
  it('maps each kind to its route', () => {
    expect(routeForKind('recurring')).toBe('/recurring');
    expect(routeForKind('budget')).toBe('/budget');
    expect(routeForKind('summary')).toBe('/insights');
  });

  it('reads the route from a Ledger notification payload', () => {
    expect(routeForNotificationData({ ledger: true, kind: 'budget', route: '/budget' })).toBe('/budget');
    expect(routeForNotificationData({ ledger: true, kind: 'summary' })).toBe('/insights');
  });

  it('ignores foreign or malformed payloads', () => {
    expect(routeForNotificationData(null)).toBeNull();
    expect(routeForNotificationData({})).toBeNull();
    expect(routeForNotificationData({ kind: 'budget' })).toBeNull(); // no ledger flag
    expect(routeForNotificationData({ ledger: false, kind: 'budget' })).toBeNull();
  });
});
