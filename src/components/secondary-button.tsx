import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { colors, hairline, radius, spacing } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Optional leading icon (monochrome). */
  icon?: React.ReactNode;
};

/** Secondary action — transparent with a thin border. */
export function SecondaryButton({ label, onPress, disabled = false, icon }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityLabel={label}
      style={styles.base}
    >
      <View style={styles.inner}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text variant="button" color={colors.primary}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: hairline,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
