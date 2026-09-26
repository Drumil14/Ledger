import { StyleSheet, View } from 'react-native';

import { MoneyText } from '@/components/money-text';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

type Props = {
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  /** Preformatted time/detail line, e.g. "9:34 AM". */
  timeLabel?: string;
  /** Show the amount as a signed expense (used on the Transactions screen). */
  showSign?: boolean;
};

/**
 * A single transaction line. Typographic hierarchy only — no coloured category
 * chips. Reusable across Home and (later) the Transactions screen.
 */
export function TransactionRow({
  merchant,
  category,
  amount,
  currency,
  timeLabel,
  showSign = false,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text variant="rowTitle" numberOfLines={1}>
          {merchant}
        </Text>
        <Text variant="metadata" color={colors.textSecondary} numberOfLines={1}>
          {timeLabel ? `${category} · ${timeLabel}` : category}
        </Text>
      </View>
      <MoneyText amount={amount} currency={currency} showSign={showSign} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  left: {
    flex: 1,
    gap: 2,
  },
});
