import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { colors, typography } from '@/constants/theme';

type Variant = 'full' | 'short';

type Props = {
  onFinish: () => void;
  /** `short` compresses the timeline for repeat launches. */
  variant?: Variant;
};

const STROKE_HEIGHT = 38;
const LOGO_HEIGHT = typography.logo.lineHeight;

/**
 * The Ledger launch sequence.
 *
 * Timeline (full):
 *   0–250ms    warm-white, nothing visible
 *   250–700ms  a thin vertical stroke grows from the centre to letter height
 *   700–1100ms the stroke dissolves as the wordmark takes over
 *   780–1500ms "Ledger" reveals horizontally (translate + scaleX + tracking)
 *   1720ms     "TRACK LESS. SPEND SMARTER." fades in beneath
 *   2150ms     the whole composition lifts ~10px and fades, handing off to auth
 *
 * The background is the app background (#FAFAF8) so the hand-off to the auth
 * stack is continuous rather than a hard navigation. Honours reduced motion.
 */
export function SplashAnimation({ onFinish, variant = 'full' }: Props) {
  const reduceMotion = useReducedMotion();

  const strokeScale = useSharedValue(0);
  const strokeOpacity = useSharedValue(1);
  const word = useSharedValue(0);
  const tagline = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(onFinish)();
    };

    if (reduceMotion) {
      // No transforms: reveal statically, brief hold, then a gentle fade out.
      strokeOpacity.set(0);
      word.set(1);
      tagline.set(1);
      exit.set(withDelay(800, withTiming(1, { duration: 320 }, done)));
      return;
    }

    const s = variant === 'short' ? 0.55 : 1;

    strokeScale.set(
      withDelay(250 * s, withTiming(1, { duration: 450 * s, easing: Easing.out(Easing.cubic) }))
    );
    strokeOpacity.set(
      withDelay(750 * s, withTiming(0, { duration: 400 * s, easing: Easing.inOut(Easing.ease) }))
    );
    word.set(
      withDelay(780 * s, withTiming(1, { duration: 720 * s, easing: Easing.out(Easing.cubic) }))
    );
    tagline.set(
      withDelay(1720 * s, withTiming(1, { duration: 380 * s, easing: Easing.out(Easing.ease) }))
    );
    exit.set(
      withDelay(2150 * s, withTiming(1, { duration: 380 * s, easing: Easing.inOut(Easing.ease) }, done))
    );
    // Mount-only sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compositionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.get(), [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(exit.get(), [0, 1], [0, -10]) }],
  }));

  const strokeStyle = useAnimatedStyle(() => ({
    opacity: strokeOpacity.get(),
    transform: [{ scaleY: strokeScale.get() }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.get(),
    letterSpacing: interpolate(word.get(), [0, 1], [6, typography.logo.letterSpacing ?? 0]),
    transform: [
      { translateX: interpolate(word.get(), [0, 1], [12, 0]) },
      { scaleX: interpolate(word.get(), [0, 1], [0.98, 1]) },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.get(),
    transform: [{ translateY: interpolate(tagline.get(), [0, 1], [6, 0]) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.center, compositionStyle]}>
        <View style={styles.logoRow}>
          <View style={styles.strokeLayer} pointerEvents="none">
            <Animated.View style={[styles.stroke, strokeStyle]} />
          </View>
          <Animated.Text
            style={[typography.logo, styles.word, wordStyle]}
            accessibilityRole="header"
            allowFontScaling={false}
          >
            Ledger
          </Animated.Text>
        </View>

        <Animated.View style={taglineStyle}>
          <Text variant="eyebrow" color={colors.textSecondary} style={styles.tagline}>
            TRACK LESS. SPEND SMARTER.
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 20,
  },
  logoRow: {
    height: LOGO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stroke: {
    width: 3,
    height: STROKE_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.primary,
    transformOrigin: 'center',
  },
  word: {
    color: colors.primary,
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
  },
});
