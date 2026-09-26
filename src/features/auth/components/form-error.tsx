import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CircleAlert } from 'lucide-react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

/** Calm, monochrome inline error for a whole form (no raw backend text). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={styles.container}
      accessibilityRole="alert"
    >
      <CircleAlert size={18} color={colors.primary} strokeWidth={1.8} />
      <Text variant="metadata" color={colors.primary} style={styles.text}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: {
    flex: 1,
  },
});
