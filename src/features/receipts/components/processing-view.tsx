import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { colors, duration, radius, spacing } from '@/constants/theme';

// Status copy cycles for feel — the backend doesn't expose real stages, so we
// don't fake percentages, just calm changing text.
const STATUSES = ['Reading receipt', 'Finding merchant', 'Finding total', 'Checking date'];

export function ProcessingView({ imageUri }: { imageUri?: string }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const scale = useSharedValue(reduceMotion ? 0.96 : 1);

  useEffect(() => {
    if (!reduceMotion) {
      scale.set(withTiming(0.96, { duration: duration.slow, easing: Easing.out(Easing.cubic) }));
    }
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % STATUSES.length);
    }, 1300);
    return () => clearInterval(timer);
  }, [reduceMotion, scale]);

  const thumbnailStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Animated.View style={[styles.thumbnail, thumbnailStyle]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel="Receipt being processed"
          />
        </Animated.View>
      ) : null}

      <Animated.View key={index} entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)}>
        <Text variant="sectionTitle" color={colors.primary} center accessibilityLiveRegion="polite">
          {STATUSES[index]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  thumbnail: {
    width: 160,
    height: 200,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  image: {
    flex: 1,
  },
});
