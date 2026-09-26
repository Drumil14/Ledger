import { Redirect, Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useDemo } from '@/features/demo/demo-context';
import { NotificationsProvider } from '@/features/notifications/notifications-provider';

/**
 * Authenticated shell. Guards the whole group (while the session resolves we
 * render nothing; a signed-out user is redirected to auth). The tabs live in a
 * nested group; Add and Edit are presented as modals over them.
 */
export default function AppLayout() {
  const { session, initializing } = useAuth();
  const { isDemoMode, hydrating } = useDemo();

  if (initializing || hydrating) return null;
  // Demo mode grants access without a Supabase session; real users still need one.
  if (!session && !isDemoMode) return <Redirect href="/landing" />;

  return (
    <NotificationsProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="budget" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recurring" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan-receipt" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="receipt" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="receipt-view" options={{ presentation: 'modal' }} />
      </Stack>
    </NotificationsProvider>
  );
}
