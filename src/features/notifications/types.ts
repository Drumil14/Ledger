/**
 * Notification domain types. Kept free of any Expo/React imports so the pure
 * scheduler logic and preferences can be unit-tested in isolation.
 */

/** How many days before an expected charge to remind. */
export type RecurringLeadDays = 1 | 3 | 7;

export const RECURRING_LEAD_OPTIONS: readonly RecurringLeadDays[] = [1, 3, 7];

/** User-controllable notification preferences (persisted in AsyncStorage). */
export type NotificationPreferences = {
  /** Remind before expected recurring charges. Default ON. */
  recurringEnabled: boolean;
  /** Notify at budget thresholds (75/90/100%). Default ON. */
  budgetEnabled: boolean;
  /** Monthly spending summary on the 1st. Default OFF. */
  monthlySummaryEnabled: boolean;
  /** Lead time for recurring reminders. Default 1 day before. */
  recurringLeadDays: RecurringLeadDays;
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  recurringEnabled: true,
  budgetEnabled: true,
  monthlySummaryEnabled: false,
  recurringLeadDays: 1,
};

/** The three kinds of Ledger notification. */
export type NotificationKind = 'recurring' | 'budget' | 'summary';

/** Routes a notification tap deep-links to. */
export type NotificationRoute = '/recurring' | '/budget' | '/insights';

/**
 * Payload attached to every Ledger notification. `ledger: true` lets us find and
 * cancel only our own scheduled notifications, never anything else on the device.
 */
export type LedgerNotificationData = {
  ledger: true;
  kind: NotificationKind;
  route: NotificationRoute;
};

/**
 * Per-month record of which budget thresholds have already fired, so each of
 * 75/90/100% notifies at most once per month. Keyed by month key (`YYYY-MM`).
 */
export type BudgetNotifyState = Record<string, number[]>;
