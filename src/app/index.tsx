import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Screen } from '@/components/screen';
import { useAuth } from '@/features/auth/auth-context';
import { useDemo } from '@/features/demo/demo-context';
import { SplashAnimation } from '@/features/splash/splash-animation';

const LAUNCHED_KEY = 'ledger.hasLaunched';

/**
 * Entry route + session gate.
 *
 * Plays the launch animation while the session resolves, then routes to the
 * app (authenticated) or the auth landing. Navigation waits for BOTH the
 * animation to finish AND auth to initialize, so an authenticated user never
 * sees the login screen flash on launch.
 */
export default function Index() {
  const { replace } = useRouter();
  const { session, initializing } = useAuth();
  const { isDemoMode, hydrating: demoHydrating } = useDemo();

  const [variant, setVariant] = useState<'full' | 'short' | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const navigated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let seen = false;
      try {
        seen = (await AsyncStorage.getItem(LAUNCHED_KEY)) === 'true';
        await AsyncStorage.setItem(LAUNCHED_KEY, 'true');
      } catch {
        // Storage is best-effort; default to the full experience.
      }
      if (active) setVariant(seen ? 'short' : 'full');
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (navigated.current) return;
    if (!animationDone || initializing || demoHydrating) return;
    navigated.current = true;
    replace(session || isDemoMode ? '/home' : '/landing');
  }, [animationDone, initializing, demoHydrating, session, isDemoMode, replace]);

  const handleFinish = useCallback(() => {
    setAnimationDone(true);
  }, []);

  if (!variant) {
    return <Screen fullBleed>{null}</Screen>;
  }

  return (
    <Screen fullBleed>
      <SplashAnimation variant={variant} onFinish={handleFinish} />
    </Screen>
  );
}
