import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Trash2 } from 'lucide-react-native';

import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { Transaction } from '@/types/transaction';

type Props = {
  transaction: Transaction;
  timeLabel?: string;
  onPress: () => void;
  onDelete: () => void;
};

/**
 * Transaction row with swipe-left-to-delete. The row itself stays tappable
 * (opens edit), which is the non-gesture alternative to deletion (edit → Delete).
 */
export function SwipeableTransactionRow({ transaction, timeLabel, onPress, onDelete }: Props) {
  const renderRightActions = () => (
    <Pressable
      onPress={onDelete}
      style={styles.deleteAction}
      accessibilityRole="button"
      accessibilityLabel={`Delete ${transaction.merchant}`}
    >
      <Trash2 size={20} color={colors.onPrimary} strokeWidth={1.9} />
      <Text variant="metadata" color={colors.onPrimary}>
        Delete
      </Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => haptics.light()}
    >
      <View style={styles.rowInner}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${transaction.merchant}`}
        >
          <TransactionRow
            merchant={transaction.merchant}
            category={transaction.category}
            amount={transaction.amount}
            currency={transaction.currency}
            timeLabel={timeLabel}
          />
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  rowInner: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  deleteAction: {
    backgroundColor: colors.primary,
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
