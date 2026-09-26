/**
 * Notification state + side-effect orchestration.
 *
 * Holds the persisted preferences and the OS permission status, and keeps the
 * scheduled notifications in sync with real Ledger data (confirmed recurring
 * expenses, the current month's budget, and the monthly summary). All Expo calls
 * go through `@/services/notifications`; screens only read/update state via the
 * `useNotifications` hook — no notification logic lives in the UI.
 *
 * Mounted inside the authenticated `(app)` group, so notifications are only ever
 * scheduled for a signed-in user.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { sumSpendingForMonth } from '@/features/budgets/summary';
import { useBudgetQuery } from '@/features/budgets/queries';
import { useDemo } from '@/features/demo/demo-context';
import { useRecurring } from '@/features/recurring/use-recurring';
import { useTransactionsQuery } from '@/features/transactions/queries';
import { currentMonthKey, monthLabel, previousMonthKey } from '@/lib/month';
import {
  configureNotifications,
  getPermissionStatus,
  requestPermission as requestPermissionService,
  scheduleMonthlySummary,
  syncBudgetNotifications,
  syncRecurringNotifications,
  type PermissionStatus,
  type RecurringReminder,
} from '@/services/notifications';
import {
  loadPreferences,
  savePreferences,
} from '@/features/notifications/preferences';
import { DEFAULT_PREFERENCES, type NotificationPreferences } from '@/features/notifications/types';

configureNotifications();

type NotificationsContextValue = {
  preferences: NotificationPreferences;
  permissionStatus: PermissionStatus;
  /** True once preferences + permission have loaded. */
  hydrated: boolean;
  /** Merge and persist a preference change. */
  setPreferences: (patch: Partial<NotificationPreferences>) => void;
  /** Prompt for OS permission; returns the resulting status. */
  requestPermission: () => Promise<PermissionStatus>;
  /** Re-read the OS permission (e.g. after returning from device settings). */
  refreshPermission: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isDemoMode } = useDemo();
  const [preferences, setPreferencesState] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [hydrated, setHydrated] = useState(false);

  // Stable "now" for the session's month math.
  const now = useMemo(() => new Date(), []);
  const monthKey = currentMonthKey(now);
  const prevMonthKey = previousMonthKey(monthKey);
  const monthName = monthLabel(monthKey).split(' ')[0];

  // Data used to derive notifications.
  const recurring = useRecurring(now);
  const transactions = useTransactionsQuery();
  const budget = useBudgetQuery(monthKey);

  // Track last-observed spend per month so budget crossings are detected.
  const spendSnapshot = useRef<Map<string, number>>(new Map());

  // Hydrate preferences + permission once. In demo mode we keep defaults in
  // memory and never read the OS permission state.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (isDemoMode) {
        if (active) setHydrated(true);
        return;
      }
      const [prefs, status] = await Promise.all([loadPreferences(), getPermissionStatus()]);
      if (!active) return;
      setPreferencesState(prefs);
      setPermissionStatus(status);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [isDemoMode]);

  const setPreferences = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      setPreferencesState((prev) => {
        const next = { ...prev, ...patch };
        // Demo preferences stay in memory — never persisted to the real device store.
        if (!isDemoMode) void savePreferences(next);
        return next;
      });
    },
    [isDemoMode]
  );

  const requestPermission = useCallback(async () => {
    // Never prompt a recruiter exploring demo mode for OS notification permission.
    if (isDemoMode) return permissionStatus;
    const status = await requestPermissionService();
    setPermissionStatus(status);
    return status;
  }, [isDemoMode, permissionStatus]);

  const refreshPermission = useCallback(async () => {
    setPermissionStatus(await getPermissionStatus());
  }, []);

  const currency =
    budget.data?.currency ?? transactions.data?.[0]?.currency ?? recurring.data?.currency ?? 'USD';

  // Confirmed recurring items → reminder inputs (only those with a date + amount).
  const reminders = useMemo<RecurringReminder[]>(() => {
    if (!recurring.data) return [];
    return recurring.data.confirmed
      .filter((item) => item.nextExpectedDate && item.record.expectedAmount !== null)
      .map((item) => ({
        recurringId: item.record.id,
        merchant: item.record.merchant,
        amount: item.record.expectedAmount ?? 0,
        nextExpectedDate: item.nextExpectedDate as string,
      }));
  }, [recurring.data]);

  // Recurring reminders: reschedule whenever the confirmed set, lead time, toggle,
  // or permission changes.
  useEffect(() => {
    if (isDemoMode || !hydrated || !recurring.data) return;
    void syncRecurringNotifications({
      reminders,
      leadDays: preferences.recurringLeadDays,
      currency,
      enabled: preferences.recurringEnabled,
    });
  }, [
    hydrated,
    recurring.data,
    reminders,
    preferences.recurringEnabled,
    preferences.recurringLeadDays,
    permissionStatus,
    currency,
    isDemoMode,
  ]);

  // Budget thresholds: evaluate against the current month whenever spend, the
  // limit, the toggle, or permission changes.
  const currentSpend = transactions.data ? sumSpendingForMonth(transactions.data, monthKey) : null;
  useEffect(() => {
    if (isDemoMode || !hydrated || currentSpend === null) return;
    const previousSpend = spendSnapshot.current.get(monthKey) ?? 0;
    void syncBudgetNotifications({
      monthKey,
      previousMonthKey: prevMonthKey,
      monthName,
      previousSpend,
      currentSpend,
      budgetLimit: budget.data ? budget.data.limit : null,
      currency,
      enabled: preferences.budgetEnabled,
    });
    spendSnapshot.current.set(monthKey, currentSpend);
  }, [
    hydrated,
    currentSpend,
    budget.data,
    preferences.budgetEnabled,
    permissionStatus,
    monthKey,
    prevMonthKey,
    monthName,
    currency,
    isDemoMode,
  ]);

  // Monthly summary: (re)schedule for the 1st of next month when enabled.
  useEffect(() => {
    if (isDemoMode || !hydrated || currentSpend === null) return;
    void scheduleMonthlySummary({
      now,
      monthName,
      spent: currentSpend,
      currency,
      enabled: preferences.monthlySummaryEnabled,
    });
  }, [
    hydrated,
    currentSpend,
    preferences.monthlySummaryEnabled,
    permissionStatus,
    now,
    monthName,
    currency,
    isDemoMode,
  ]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      preferences,
      permissionStatus,
      hydrated,
      setPreferences,
      requestPermission,
      refreshPermission,
    }),
    [preferences, permissionStatus, hydrated, setPreferences, requestPermission, refreshPermission]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
