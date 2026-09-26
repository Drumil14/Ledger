import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { colors, radius, spacing, typography } from '@/constants/theme';

export type ButtonState = 'idle' | 'loading' | 'success';

type Props = {
  label: string;
  onPress: () => void;
  state?: ButtonState;
  disabled?: boolean;
};

/**
 * Primary action — solid black. Handles the submit micro-interaction:
 * label → spinner → check, each crossfading in place so the button never
 * changes size.
 */
export function PrimaryButton({ label, onPress, state = 'idle', disabled = false }: Props) {
  const busy = state !== 'idle';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      haptic="medium"
      accessibilityLabel={label}
      style={styles.base}
    >
      <View style={styles.inner}>
        {state === 'idle' ? (
          <Animated.View key="label" entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)}>
            <Text variant="button" color={colors.onPrimary}>
              {label}
            </Text>
          </Animated.View>
        ) : null}

        {state === 'loading' ? (
          <Animated.View key="spinner" entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)}>
            <ActivityIndicator color={colors.onPrimary} size="small" />
          </Animated.View>
        ) : null}

        {state === 'success' ? (
          <Animated.View key="check" entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)}>
            <Check color={colors.onPrimary} size={22} strokeWidth={2.4} />
          </Animated.View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Reserve the label height so the crossfade layers stay centered.
    minHeight: typography.button.lineHeight,
  },
});
