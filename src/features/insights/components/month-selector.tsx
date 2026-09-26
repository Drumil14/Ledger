import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { isFutureMonth, monthLabel, nextMonthKey, previousMonthKey } from '@/lib/month';

type Props = {
  monthKey: string;
  onChange: (monthKey: string) => void;
  now: Date;
};

/**
 * `‹  September 2026  ›` — steps through months. The forward arrow is disabled
 * at the current month (we never navigate into the future). A selection haptic
 * fires on every change.
 */
export function MonthSelector({ monthKey, onChange, now }: Props) {
  const canGoForward = isFutureMonth(nextMonthKey(monthKey), now) === false;

  const go = (target: string) => {
    haptics.selection();
    onChange(target);
  };

  return (
    <View style={styles.container} accessibilityRole="adjustable" accessibilityLabel={monthLabel(monthKey)}>
      <Pressable
        onPress={() => go(previousMonthKey(monthKey))}
        hitSlop={12}
        style={styles.arrow}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
      >
        <ChevronLeft size={22} color={colors.primary} strokeWidth={1.8} />
      </Pressable>

      <Text variant="rowTitle" style={styles.label}>
        {monthLabel(monthKey)}
      </Text>

      <Pressable
        onPress={canGoForward ? () => go(nextMonthKey(monthKey)) : undefined}
        disabled={!canGoForward}
        hitSlop={12}
        style={styles.arrow}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: !canGoForward }}
      >
        <ChevronRight
          size={22}
          color={canGoForward ? colors.primary : colors.disabled}
          strokeWidth={1.8}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    minWidth: 150,
    textAlign: 'center',
  },
});
