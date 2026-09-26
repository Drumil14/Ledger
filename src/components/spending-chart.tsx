import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { colors, duration, radius, spacing } from '@/constants/theme';
import { describeAmount } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import type { ChartPoint } from '@/features/home/overview';

type Props = {
  data: ChartPoint[];
  height?: number;
  /** Key of the currently selected day, or null for the default state. */
  selectedKey?: string | null;
  /** Fired when a day column is tapped; enables interaction when provided. */
  onSelectDay?: (point: ChartPoint) => void;
};

const LABEL_AREA = 22;
const MIN_BAR = 3;
const MUTED_OPACITY = 0.22;

// Hoisted: "September 23" for accessibility labels.
const monthDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

function accessibilityLabelFor(point: ChartPoint): string {
  const dateLabel = monthDayFormatter.format(new Date(Number(point.key)));
  if (point.value <= 0) return `${dateLabel}. No expenses.`;
  const noun = point.count === 1 ? 'transaction' : 'transactions';
  return `${dateLabel}. ${describeAmount(point.value)} spent across ${point.count} ${noun}.`;
}

function Bar({
  heightPx,
  delay,
  emphasized,
}: {
  heightPx: number;
  delay: number;
  emphasized: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0);
  const opacity = useSharedValue(emphasized ? 1 : MUTED_OPACITY);

  // Grow in once on mount (never replays on selection changes).
  useEffect(() => {
    if (reduceMotion) return;
    grow.set(withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
  }, [delay, reduceMotion, grow]);

  // Smoothly fade between emphasized (full ink) and muted as selection changes.
  useEffect(() => {
    const target = emphasized ? 1 : MUTED_OPACITY;
    opacity.set(reduceMotion ? target : withTiming(target, { duration: duration.base }));
  }, [emphasized, reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: grow.get() }],
    opacity: opacity.get(),
  }));

  return <Animated.View style={[styles.bar, { height: heightPx }, style]} />;
}

/**
 * Restrained bar chart of the last 7 days' spend. Monochrome — the selected day
 * (or, with no selection, the most recent day) is full-ink; the rest dim via
 * opacity. Each column is a full-height, accessible tap target so even zero-spend
 * days can be selected.
 */
export function SpendingChart({ data, height = 132, selectedKey = null, onSelectDay }: Props) {
  const barMax = height - LABEL_AREA;
  const max = Math.max(...data.map((d) => d.value), 1);
  const lastIndex = data.length - 1;
  const hasSelection = selectedKey != null;

  return (
    <View
      style={[styles.container, { height }]}
      accessibilityRole={onSelectDay ? undefined : 'image'}
      accessibilityLabel={onSelectDay ? undefined : 'Spending over the last seven days'}
    >
      {data.map((point, index) => {
        const barHeight = Math.max((point.value / max) * barMax, MIN_BAR);
        const emphasized = hasSelection ? point.key === selectedKey : index === lastIndex;

        return (
          <Pressable
            key={point.key}
            onPress={() => {
              haptics.light();
              onSelectDay?.(point);
            }}
            disabled={!onSelectDay}
            accessibilityRole={onSelectDay ? 'button' : undefined}
            accessibilityLabel={onSelectDay ? accessibilityLabelFor(point) : undefined}
            accessibilityState={onSelectDay ? { selected: point.key === selectedKey } : undefined}
            style={styles.column}
          >
            <View style={[styles.barArea, { height: barMax }]}>
              <Bar heightPx={barHeight} delay={index * 45} emphasized={emphasized} />
            </View>
            <Text variant="metadata" color={colors.disabled} style={styles.label}>
              {point.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  barArea: {
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '46%',
    maxWidth: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    transformOrigin: 'bottom',
  },
  label: {
    textAlign: 'center',
  },
});
