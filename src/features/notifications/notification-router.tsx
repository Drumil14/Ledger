/**
 * Routes notification taps to the right screen, in every launch state:
 * foreground, background, and cold start. Auth-aware — a pending route is held
 * until a session exists, so tapping a notification while signed out never skips
 * the auth gate; it deep-links right after login.
 *
 * Renders nothing; mounted once near the app root.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import {
  addResponseListener,
  configureNotifications,
  getLaunchRoute,
} from '@/services/notifications';
import type { NotificationRoute } from '@/features/notifications/types';

configureNotifications();

export function NotificationRouter() {
  const router = useRouter();
  const { session, initializing } = useAuth();

  // The route to open is held in a ref; a bump counter wakes the navigation
  // effect. This keeps setState out of the effect body (it only runs in the
  // listener callbacks) while still deferring navigation until a session exists.
  const pendingRoute = useRef<NotificationRoute | null>(null);
  const [signal, setSignal] = useState(0);
  const handledLaunch = useRef(false);

  const enqueue = (route: NotificationRoute) => {
    pendingRoute.current = route;
    setSignal((n) => n + 1);
  };

  // Cold start: pick up the notification that launched the app (once).
  useEffect(() => {
    if (handledLaunch.current) return;
    handledLaunch.current = true;
    void (async () => {
      const route = await getLaunchRoute();
      if (route) enqueue(route);
    })();
  }, []);

  // Foreground / background taps while the app is alive.
  useEffect(() => addResponseListener(enqueue), []);

  // Navigate once a session is available; otherwise hold until after login.
  useEffect(() => {
    const route = pendingRoute.current;
    if (!route || initializing || !session) return;
    pendingRoute.current = null;
    router.push(route);
  }, [signal, session, initializing, router]);

  return null;
}
