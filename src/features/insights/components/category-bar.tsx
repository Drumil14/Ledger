import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { MoneyText } from '@/components/money-text';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/money';

type Props = {
  category: string;
  amount: number;
  currency: string;
  /** 0–1 share of the largest category (drives the bar width). */
  fraction: number;
  /** Whole-percent share of the month, for the accessibility summary. */
  percent: number;
  monthName: string;
  delay?: number;
};

const MIN_FRACTION = 0.04; // keep a sliver visible for tiny categories

/**
 * One "Where it went" row: category + amount above a monochrome bar whose width
 * encodes its share of the largest category. The bar grows in from the left
 * (skipped under Reduce Motion). The whole row carries a spoken summary so the
 * bar never conveys meaning by width alone.
 */
export function CategoryBar({
  category,
  amount,
  currency,
  fraction,
  percent,
  monthName,
  delay = 0,
}: Props) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(Math.min(fraction, 1), MIN_FRACTION);
  const grow = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      grow.set(target);
      return;
    }
    grow.set(withDelay(delay, withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) })));
  }, [target, delay, reduceMotion, grow]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.get() }] }));

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`${category}: ${formatCurrency(amount, currency)}, ${percent} percent of ${monthName} spending.`}
    >
      <View style={styles.labelRow}>
        <Text variant="rowTitle" numberOfLines={1} style={styles.name}>
          {category}
        </Text>
        <MoneyText amount={amount} currency={currency} />
      </View>
      <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    flex: 1,
  },
  track: {
    height: 6,
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    transformOrigin: 'left',
  },
});
