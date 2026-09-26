import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { MoneyText } from '@/components/money-text';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { colors, duration, spacing } from '@/constants/theme';
import type { DaySummary } from '@/features/home/day-summary';
import type { Transaction } from '@/types/transaction';

const titleFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

type Props = {
  /** Selected day summary, or null when nothing is selected. */
  summary: DaySummary | null;
  currency: string;
  onClose: () => void;
  onSelectTransaction: (id: string) => void;
};

/**
 * Bottom sheet showing every transaction for the tapped chart day. Reuses the
 * existing `BottomSheet` primitive and `TransactionRow` — no new transaction UI.
 * Rows are virtualized with `FlatList` for busy days, and a zero-spend day shows a
 * clear message rather than a blank sheet.
 */
export function DayExpensesSheet({ summary, currency, onClose, onSelectTransaction }: Props) {
  const reduceMotion = useReducedMotion();

  // Keep rendering the last summary through the close animation so the panel never
  // flashes empty as it slides down (mirrors BottomSheet's delayed-unmount).
  const [shown, setShown] = useState<DaySummary | null>(summary);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (summary) setShown(summary);
  }, [summary]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(duration.base).delay(index * 40)}
    >
      <Pressable
        onPress={() => onSelectTransaction(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.merchant}`}
      >
        <TransactionRow
          merchant={item.merchant}
          category={item.category}
          amount={item.amount}
          currency={item.currency}
          timeLabel={timeFormatter.format(new Date(item.date))}
        />
      </Pressable>
    </Animated.View>
  );

  return (
    <BottomSheet
      visible={summary !== null}
      onClose={onClose}
      title={shown ? titleFormatter.format(shown.date) : ''}
    >
      {shown ? (
        <>
          <View style={styles.header}>
            <MoneyText amount={shown.total} currency={currency} variant="display" />
            <Text variant="metadata" color={colors.textSecondary}>
              {shown.count === 0
                ? 'No expenses recorded this day.'
                : `${shown.count} ${shown.count === 1 ? 'expense' : 'expenses'}`}
            </Text>
          </View>

          {shown.count > 0 ? (
            <>
              <Divider />
              <FlatList
                data={shown.transactions}
                keyExtractor={(t) => t.id}
                renderItem={renderItem}
                ItemSeparatorComponent={Divider}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 360,
  },
});
