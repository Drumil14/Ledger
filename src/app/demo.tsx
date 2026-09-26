import { useEffect, useRef } from 'react';

import { Screen } from '@/components/screen';
import { useDemo } from '@/features/demo/demo-context';

/**
 * Public recruiter entry point (`/demo`).
 *
 * Automatically starts Demo Mode and hands off to Home — no login, no register,
 * no account. This is primarily the web demo entry; native startup (splash → auth
 * landing) is unchanged. Refreshing restores the pristine deterministic dataset,
 * since demo data lives only in memory and is regenerated on entry.
 */
export default function Demo() {
  const { enterDemo, hydrating } = useDemo();
  const started = useRef(false);

  useEffect(() => {
    if (hydrating || started.current) return;
    started.current = true;
    enterDemo(); // activates Demo Mode and replaces to /home
  }, [hydrating, enterDemo]);

  // Blank warm-white screen for the brief moment before the redirect to Home.
  return <Screen fullBleed>{null}</Screen>;
}
