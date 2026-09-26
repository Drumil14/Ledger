import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

type Props = {
  label: string;
  value?: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  /** Trailing icon (e.g. chevron / calendar). */
  right?: React.ReactNode;
};

/** A tappable field that looks like FormField but opens a picker/sheet. */
export function FieldButton({ label, value, placeholder, onPress, error, right }: Props) {
  const hasValue = !!value;
  return (
    <View style={styles.container}>
      <Text variant="metadata" color={colors.textSecondary} style={styles.label}>
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        style={[styles.field, { borderColor: error ? colors.primary : colors.divider }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${hasValue ? value : (placeholder ?? 'not set')}`}
      >
        <Text variant="body" color={hasValue ? colors.primary : colors.disabled}>
          {hasValue ? value : placeholder}
        </Text>
        {right}
      </Pressable>
      {error ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
          <Text variant="metadata" color={colors.primary} style={styles.error}>
            {error}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  error: {
    marginLeft: spacing.xs,
  },
});
