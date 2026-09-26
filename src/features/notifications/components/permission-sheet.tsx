import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

type Mode = 'prompt' | 'denied';

type Props = {
  visible: boolean;
  mode: Mode;
  /** Request OS permission (prompt mode). */
  onEnable: () => void;
  /** Open device settings (denied mode). */
  onOpenSettings: () => void;
  onClose: () => void;
};

const COPY: Record<Mode, { title: string; message: string; action: string }> = {
  prompt: {
    title: 'Enable notifications?',
    message:
      'Ledger can remind you before expected charges and when you’re nearing your budget.',
    action: 'Enable notifications',
  },
  denied: {
    title: 'Notifications are off',
    message: 'You can enable them later in your device settings.',
    action: 'Open Settings',
  },
};

/**
 * Permission pre-prompt / denied sheet. Monochrome; intent carried by copy. Shown
 * only when the user turns a feature on — never on first launch.
 */
export function PermissionSheet({ visible, mode, onEnable, onOpenSettings, onClose }: Props) {
  const copy = COPY[mode];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={copy.title}>
      <Text variant="body" color={colors.textSecondary} style={styles.message}>
        {copy.message}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton
          label={copy.action}
          onPress={mode === 'prompt' ? onEnable : onOpenSettings}
        />
        <Pressable
          onPress={onClose}
          style={styles.cancel}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text variant="button" color={colors.textSecondary}>
            Not now
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: {
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.xs,
  },
  cancel: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
