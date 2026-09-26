import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { duration } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type HapticKind = keyof typeof haptics | 'none';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Target scale while pressed. */
  scaleTo?: number;
  /** Haptic fired on activation. Defaults to a light selection tick. */
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Press wrapper with a subtle 1 → 0.97 → 1 scale, driven entirely on the UI
 * thread. Stores the press *state* (0/1) and derives the scale, per the
 * ground-truth animation rule. Falls back to no scale under reduced motion.
 */
export function PressableScale({
  children,
  onPress,
  disabled = false,
  scaleTo = 0.97,
  haptic = 'selection',
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const fire = () => {
    if (haptic !== 'none') haptics[haptic]();
    onPress?.();
  };

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDuration(1500)
    .maxDistance(24)
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: duration.instant }));
    })
    .onFinalize(() => {
      pressed.set(withTiming(0, { duration: duration.fast }));
    })
    .onEnd(() => {
      runOnJS(fire)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: reduceMotion ? 1 : interpolate(pressed.get(), [0, 1], [1, scaleTo]) },
    ],
    opacity: disabled ? 0.55 : 1,
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[animatedStyle, style]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
