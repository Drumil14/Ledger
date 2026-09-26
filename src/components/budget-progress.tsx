import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '@/constants/theme';

type Props = {
  /** 0–1 share of budget used. */
  progress: number;
};

/** Monochrome budget bar: black fill on a light track, grows in on mount. */
export function BudgetProgress({ progress }: Props) {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(0);
  const target = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    if (reduceMotion) {
      value.set(target);
      return;
    }
    value.set(withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [target, reduceMotion, value]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: value.get() }],
  }));

  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    // Grow from the left edge.
    transformOrigin: 'left',
  },
});
