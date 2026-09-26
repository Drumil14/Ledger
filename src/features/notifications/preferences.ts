/**
 * Local persistence for notification preferences and budget-threshold bookkeeping.
 *
 * Everything lives in AsyncStorage (no server round-trip): preferences are a
 * device-level choice, and the "which thresholds already fired this month" record
 * must survive app restarts so we never double-notify. All reads merge over the
 * defaults so a partial/old stored blob can never produce an invalid shape.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PREFERENCES,
  RECURRING_LEAD_OPTIONS,
  type BudgetNotifyState,
  type NotificationPreferences,
  type RecurringLeadDays,
} from './types';

const PREFERENCES_KEY = 'ledger.notifications.preferences';
const BUDGET_STATE_KEY = 'ledger.notifications.budgetThresholds';

/** Coerce arbitrary stored JSON into a valid preferences object. */
export function normalizePreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFERENCES };
  const value = raw as Partial<Record<keyof NotificationPreferences, unknown>>;

  const lead = value.recurringLeadDays;
  const recurringLeadDays: RecurringLeadDays = RECURRING_LEAD_OPTIONS.includes(
    lead as RecurringLeadDays
  )
    ? (lead as RecurringLeadDays)
    : DEFAULT_PREFERENCES.recurringLeadDays;

  return {
    recurringEnabled:
      typeof value.recurringEnabled === 'boolean'
        ? value.recurringEnabled
        : DEFAULT_PREFERENCES.recurringEnabled,
    budgetEnabled:
      typeof value.budgetEnabled === 'boolean'
        ? value.budgetEnabled
        : DEFAULT_PREFERENCES.budgetEnabled,
    monthlySummaryEnabled:
      typeof value.monthlySummaryEnabled === 'boolean'
        ? value.monthlySummaryEnabled
        : DEFAULT_PREFERENCES.monthlySummaryEnabled,
    recurringLeadDays,
  };
}

export async function loadPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    return normalizePreferences(JSON.parse(stored));
  } catch {
    // Corrupt / unavailable storage should never crash the app.
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(preferences: NotificationPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Non-fatal: a failed write just means the choice isn't persisted.
  }
}

/** Coerce arbitrary stored JSON into a valid budget-notify state. */
export function normalizeBudgetState(raw: unknown): BudgetNotifyState {
  if (!raw || typeof raw !== 'object') return {};
  const out: BudgetNotifyState = {};
  for (const [monthKey, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[monthKey] = value.filter((n): n is number => typeof n === 'number');
    }
  }
  return out;
}

export async function loadBudgetState(): Promise<BudgetNotifyState> {
  try {
    const stored = await AsyncStorage.getItem(BUDGET_STATE_KEY);
    if (!stored) return {};
    return normalizeBudgetState(JSON.parse(stored));
  } catch {
    return {};
  }
}

export async function saveBudgetState(state: BudgetNotifyState): Promise<void> {
  try {
    await AsyncStorage.setItem(BUDGET_STATE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal.
  }
}
