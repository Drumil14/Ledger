/**
 * Intentional, sparse haptics. Each helper maps a UX moment to a feedback type
 * per the brand guidelines. Safely no-ops on web / unsupported platforms.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn: () => Promise<unknown>) {
  if (!supported) return;
  // Fire-and-forget; a failed haptic should never break the interaction.
  void fn().catch(() => {});
}

export const haptics = {
  /** Tab changes, light navigation. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Committed actions (expense saved, primary submit). */
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Discrete selection (category / control taps). */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Successful completion. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Destructive / risky (delete). */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Errors (failed validation / request). */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
} as const;
