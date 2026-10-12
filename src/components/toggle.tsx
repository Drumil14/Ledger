import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import { colors, duration, radius } from '@/constants/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

const TRACK_W = 48;
const TRACK_H = 28;
const PAD = 2;
const THUMB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

/**
 * Monochrome toggle. React Native's `Switch` renders a platform-coloured (green)
 * track on web/iOS that breaks Ledger's black-and-white identity, so this is the
 * one toggle used across the app: ink track when on, hairline-grey when off, a
 * warm-white thumb that slides. UI-thread animation; honours reduced motion.
 * Haptics are left to callers, matching the rest of the control set.
 */
export function Toggle({ value, onValueChange, disabled = false, accessibilityLabel }: Props) {
  const reduceMotion = useReducedMotion();

  const progress = useDerivedValue(
    () => (reduceMotion ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: duration.fast })),
    [value, reduceMotion]
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.divider, colors.primary]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.get(), [0, 1], [0, TRAVEL]) }],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.pill,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
