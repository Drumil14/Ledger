/// <reference types="jest" />
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadBudgetState,
  loadPreferences,
  normalizeBudgetState,
  normalizePreferences,
  saveBudgetState,
  savePreferences,
} from '@/features/notifications/preferences';
import { DEFAULT_PREFERENCES } from '@/features/notifications/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('default preferences', () => {
  it('has recurring + budget on, summary off, 1-day lead', () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      recurringEnabled: true,
      budgetEnabled: true,
      monthlySummaryEnabled: false,
      recurringLeadDays: 1,
    });
  });

  it('returns defaults when nothing is stored', async () => {
    expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('normalizePreferences', () => {
  it('merges partial stored values over defaults', () => {
    expect(normalizePreferences({ recurringEnabled: false })).toEqual({
      ...DEFAULT_PREFERENCES,
      recurringEnabled: false,
    });
  });

  it('rejects an invalid lead value', () => {
    expect(normalizePreferences({ recurringLeadDays: 5 }).recurringLeadDays).toBe(1);
    expect(normalizePreferences({ recurringLeadDays: 7 }).recurringLeadDays).toBe(7);
  });

  it('falls back to defaults for garbage input', () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences('nope')).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('preferences persistence', () => {
  it('round-trips saved preferences', async () => {
    const prefs = {
      recurringEnabled: false,
      budgetEnabled: true,
      monthlySummaryEnabled: true,
      recurringLeadDays: 3 as const,
    };
    await savePreferences(prefs);
    expect(await loadPreferences()).toEqual(prefs);
  });
});

describe('budget notify state', () => {
  it('normalizes away non-array / non-number entries', () => {
    expect(
      normalizeBudgetState({ '2026-09': [75, 'x', 90], '2026-08': 'nope', bad: 5 })
    ).toEqual({ '2026-09': [75, 90] });
  });

  it('round-trips per-month thresholds', async () => {
    await saveBudgetState({ '2026-09': [75, 90] });
    expect(await loadBudgetState()).toEqual({ '2026-09': [75, 90] });
  });

  it('returns an empty record when nothing is stored', async () => {
    expect(await loadBudgetState()).toEqual({});
  });
});
