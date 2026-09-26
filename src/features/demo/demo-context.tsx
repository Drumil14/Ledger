/**
 * Demo mode context.
 *
 * Owns the demo lifecycle and exposes a small, intention-revealing API to the UI:
 * `isDemoMode`, `enterDemo`, `exitDemo`, `resetDemo`. It coordinates three things
 * on every transition:
 *
 *   1. the non-React runtime singleton (so the repository layer routes data),
 *   2. the persisted flag (so a mid-demo relaunch stays in demo),
 *   3. the React Query cache (cleared on enter/exit so real and demo data can
 *      never bleed into one another).
 *
 * A stable per-session reference date is used to generate demo data, so all
 * relative-month logic agrees across screens for the life of the session.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { activateDemo, deactivateDemo, isDemoActive } from './demo-runtime';
import { loadDemoFlag, saveDemoFlag } from './demo-storage';

type DemoContextValue = {
  /** True while demo mode is active. */
  isDemoMode: boolean;
  /** True until the persisted demo flag has been read on launch. */
  hydrating: boolean;
  /** Start demo mode with a fresh dataset and navigate into the app. */
  enterDemo: () => void;
  /** Leave demo mode, drop demo data, and return to the auth landing. */
  exitDemo: () => void;
  /** Restore the original demo dataset (keeps the user in demo mode). */
  resetDemo: () => void;
};

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  // Stable reference date for the whole session's demo data generation.
  const referenceDate = useRef(new Date());

  // On launch, restore demo mode if the flag was persisted (navigation
  // continuity), always regenerating a fresh dataset (mutations never persist).
  useEffect(() => {
    let active = true;
    void (async () => {
      const wasDemo = await loadDemoFlag();
      if (!active) return;
      if (wasDemo) {
        activateDemo(referenceDate.current);
        setIsDemoMode(true);
      }
      setHydrating(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const enterDemo = useCallback(() => {
    activateDemo(referenceDate.current);
    void saveDemoFlag(true);
    // Drop any real-user cache so nothing bleeds into the demo session.
    queryClient.clear();
    setIsDemoMode(true);
    router.replace('/home');
  }, [queryClient]);

  const exitDemo = useCallback(() => {
    deactivateDemo();
    void saveDemoFlag(false);
    // Drop demo data from the cache so a later real login starts clean.
    queryClient.clear();
    setIsDemoMode(false);
    router.replace('/landing');
  }, [queryClient]);

  const resetDemo = useCallback(() => {
    if (!isDemoActive()) return;
    // Regenerate the pristine dataset and re-fetch every derived view.
    activateDemo(referenceDate.current);
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const value = useMemo<DemoContextValue>(
    () => ({ isDemoMode, hydrating, enterDemo, exitDemo, resetDemo }),
    [isDemoMode, hydrating, enterDemo, exitDemo, resetDemo]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within a DemoProvider');
  return ctx;
}
