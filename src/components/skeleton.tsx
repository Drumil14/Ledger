import { useEffect } from 'react';
import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '@/constants/theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
};

/** Subtle pulsing placeholder block. */
export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm }: Props) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(1, { duration: 850 }), -1, true));
  }, [reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return <Animated.View style={[styles.block, { width, height, borderRadius }, style]} />;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceAlt,
  },
});
