/**
 * Expo Notifications service — the only module that talks to the native
 * notification API. Screens and hooks call these functions; they never import
 * `expo-notifications` directly.
 *
 * All scheduling decisions/copy come from the pure `features/notifications`
 * modules. This layer just applies them: request permission, schedule at a local
 * `Date`, present immediately, and cancel — always guarded so an unsupported
 * platform or a missing permission is a quiet no-op, never a thrown error.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  buildBudgetContent,
  buildRecurringContent,
  buildSummaryContent,
  budgetNotificationId,
  computeMonthlySummaryDate,
  computeRecurringReminderDate,
  getCrossedBudgetThreshold,
  recurringNotificationId,
  routeForKind,
  routeForNotificationData,
  thresholdsSatisfied,
  SUMMARY_NOTIFICATION_ID,
  type NotificationContent,
} from '@/features/notifications/scheduler';
import { loadBudgetState, saveBudgetState } from '@/features/notifications/preferences';
import type {
  BudgetNotifyState,
  LedgerNotificationData,
  NotificationKind,
  NotificationRoute,
  RecurringLeadDays,
} from '@/features/notifications/types';

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/* -------------------------------------------------------------------------- */
/* One-time configuration                                                     */
/* -------------------------------------------------------------------------- */

let configured = false;

/**
 * Register the foreground presentation handler and the Android channel. Safe to
 * call more than once; only the first call takes effect.
 */
export function configureNotifications(): void {
  if (configured || !isSupported) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Ledger',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Permissions                                                                */
/* -------------------------------------------------------------------------- */

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (!isSupported) return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'undetermined';
  }
}

/** Prompt for permission (the OS dialog). Returns the resulting status. */
export async function requestPermission(): Promise<PermissionStatus> {
  if (!isSupported) return 'denied';
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'undetermined';
  }
}

async function hasPermission(): Promise<boolean> {
  return (await getPermissionStatus()) === 'granted';
}

/* -------------------------------------------------------------------------- */
/* Low-level scheduling primitives                                            */
/* -------------------------------------------------------------------------- */

function dataFor(kind: NotificationKind): LedgerNotificationData {
  return { ledger: true, kind, route: routeForKind(kind) };
}

/** Schedule a notification at a specific local date. Past dates are skipped. */
async function scheduleAt(
  identifier: string,
  content: NotificationContent,
  date: Date,
  kind: NotificationKind
): Promise<void> {
  if (!isSupported) return;
  if (date.getTime() <= Date.now()) return; // never schedule in the past
  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { ...content, data: dataFor(kind) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  } catch {
    // Non-fatal — a failed schedule shouldn't surface to the user.
  }
}

/** Present a notification immediately (used for budget thresholds). */
async function presentNow(
  identifier: string,
  content: NotificationContent,
  kind: NotificationKind
): Promise<void> {
  if (!isSupported) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { ...content, data: dataFor(kind) },
      trigger: null,
    });
  } catch {
    // Non-fatal.
  }
}

export async function cancelNotification(identifier: string): Promise<void> {
  if (!isSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Non-fatal.
  }
}

/** All currently-scheduled notifications that belong to Ledger. */
async function scheduledLedger(): Promise<Notifications.NotificationRequest[]> {
  if (!isSupported) return [];
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter((n) => {
      const data = n.content.data as { ledger?: unknown } | null;
      return data?.ledger === true;
    });
  } catch {
    return [];
  }
}

async function cancelLedgerByKind(kind: NotificationKind): Promise<void> {
  const scheduled = await scheduledLedger();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { kind?: unknown }).kind === kind)
      .map((n) => cancelNotification(n.identifier))
  );
}

/** Cancel every Ledger-scheduled notification (leaves foreign ones untouched). */
export async function cancelAllLedgerNotifications(): Promise<void> {
  const scheduled = await scheduledLedger();
  await Promise.all(scheduled.map((n) => cancelNotification(n.identifier)));
}

/* -------------------------------------------------------------------------- */
/* Recurring reminders                                                        */
/* -------------------------------------------------------------------------- */

export type RecurringReminder = {
  recurringId: string;
  merchant: string;
  amount: number;
  /** ISO `YYYY-MM-DD` next expected charge date. */
  nextExpectedDate: string;
};

/**
 * Reconcile scheduled recurring reminders to exactly the current confirmed set:
 * cancel all existing recurring reminders, then (re)schedule one per item whose
 * reminder date is still in the future. Cancel-then-reschedule with stable ids
 * guarantees no stale duplicates after a confirm/edit/remove.
 */
export async function syncRecurringNotifications(input: {
  reminders: RecurringReminder[];
  leadDays: RecurringLeadDays;
  currency: string;
  enabled: boolean;
}): Promise<void> {
  if (!isSupported) return;
  await cancelLedgerByKind('recurring');
  if (!input.enabled || !(await hasPermission())) return;

  await Promise.all(
    input.reminders.map((reminder) => {
      const date = computeRecurringReminderDate(reminder.nextExpectedDate, input.leadDays);
      const content = buildRecurringContent({
        merchant: reminder.merchant,
        amount: reminder.amount,
        currency: input.currency,
        leadDays: input.leadDays,
      });
      return scheduleAt(recurringNotificationId(reminder.recurringId), content, date, 'recurring');
    })
  );
}

/* -------------------------------------------------------------------------- */
/* Budget thresholds                                                          */
/* -------------------------------------------------------------------------- */

/** Keep only the current + previous month's threshold bookkeeping. */
function pruneBudgetState(state: BudgetNotifyState, keepMonthKeys: string[]): BudgetNotifyState {
  const keep = new Set(keepMonthKeys);
  const out: BudgetNotifyState = {};
  for (const [monthKey, thresholds] of Object.entries(state)) {
    if (keep.has(monthKey)) out[monthKey] = thresholds;
  }
  return out;
}

/**
 * Evaluate the current month's budget and, if a new threshold has just been
 * crossed, present exactly one notification — then persist every satisfied
 * threshold so lower levels never re-fire and each level fires once per month.
 */
export async function syncBudgetNotifications(input: {
  monthKey: string;
  previousMonthKey: string;
  monthName: string;
  previousSpend: number;
  currentSpend: number;
  budgetLimit: number | null;
  currency: string;
  enabled: boolean;
}): Promise<void> {
  if (!isSupported || !input.enabled || input.budgetLimit === null) return;
  if (!(await hasPermission())) return;

  const state = await loadBudgetState();
  const alreadyNotified = state[input.monthKey] ?? [];

  const threshold = getCrossedBudgetThreshold({
    previousSpend: input.previousSpend,
    currentSpend: input.currentSpend,
    budgetLimit: input.budgetLimit,
    alreadyNotified,
  });

  if (threshold === null) return;

  const remaining = input.budgetLimit - input.currentSpend;
  await presentNow(
    budgetNotificationId(input.monthKey, threshold),
    buildBudgetContent({
      threshold,
      monthName: input.monthName,
      remaining,
      currency: input.currency,
    }),
    'budget'
  );

  // Mark all satisfied thresholds so lower ones can't fire later this month.
  const satisfied = thresholdsSatisfied(input.currentSpend, input.budgetLimit);
  const merged = Array.from(new Set([...alreadyNotified, ...satisfied]));
  const next = pruneBudgetState(
    { ...state, [input.monthKey]: merged },
    [input.monthKey, input.previousMonthKey]
  );
  await saveBudgetState(next);
}

/* -------------------------------------------------------------------------- */
/* Monthly summary                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Cancel any existing summary and, if enabled, schedule the next one for the
 * first of next month at 9 AM local time.
 */
export async function scheduleMonthlySummary(input: {
  now: Date;
  monthName: string;
  spent: number;
  currency: string;
  enabled: boolean;
}): Promise<void> {
  if (!isSupported) return;
  await cancelNotification(SUMMARY_NOTIFICATION_ID);
  if (!input.enabled || !(await hasPermission())) return;

  await scheduleAt(
    SUMMARY_NOTIFICATION_ID,
    buildSummaryContent({ monthName: input.monthName, spent: input.spent, currency: input.currency }),
    computeMonthlySummaryDate(input.now),
    'summary'
  );
}

/* -------------------------------------------------------------------------- */
/* Tap handling                                                               */
/* -------------------------------------------------------------------------- */

/** The route from the notification that cold-launched the app, if any. */
export async function getLaunchRoute(): Promise<NotificationRoute | null> {
  if (!isSupported) return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return routeForNotificationData(response.notification.request.content.data);
  } catch {
    return null;
  }
}

/** Subscribe to notification taps while the app is running. Returns an unsubscribe. */
export function addResponseListener(handler: (route: NotificationRoute) => void): () => void {
  if (!isSupported) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = routeForNotificationData(response.notification.request.content.data);
    if (route) handler(route);
  });
  return () => subscription.remove();
}
