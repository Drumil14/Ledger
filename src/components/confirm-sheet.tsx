import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Monochrome confirmation sheet. The confirm action uses the solid dark button
 * (no red) — destructive intent is carried by copy, not colour.
 */
export function ConfirmSheet({ visible, title, message, confirmLabel, onConfirm, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {message ? (
        <Text variant="body" color={colors.textSecondary} style={styles.message}>
          {message}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton label={confirmLabel} onPress={onConfirm} />
        <Pressable
          onPress={onClose}
          style={styles.cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text variant="button" color={colors.textSecondary}>
            Cancel
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
