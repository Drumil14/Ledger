import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { formatMoney } from '@/components/money-text';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export type PatternRow = { id: string; date: string; amount: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Merchant name — the sheet title. */
  title: string;
  /** e.g. "Monthly · detected 3 times". */
  meta: string;
  rows: PatternRow[];
  currency: string;
  /** Optional "Expected around Oct 14" line for confirmed patterns. */
  nextChargeLabel?: string;
  /** Action buttons (Confirm / Not recurring / Remove …). */
  children: React.ReactNode;
};

/**
 * Shows *why* a pattern was detected: each matching charge with its date and
 * amount, so the decision is transparent. Reused for both candidates and
 * confirmed subscriptions; the caller supplies the action buttons.
 */
export function PatternSheet({
  visible,
  onClose,
  title,
  meta,
  rows,
  currency,
  nextChargeLabel,
  children,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Text variant="metadata" color={colors.textSecondary} style={styles.meta}>
        {meta}
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, index) => (
          <View key={row.id}>
            <View
              style={styles.row}
              accessibilityRole="text"
              accessibilityLabel={`${dateFormatter.format(new Date(row.date))}, ${formatMoney(
                row.amount,
                currency
              )}`}
            >
              <Text variant="body" color={colors.textSecondary}>
                {dateFormatter.format(new Date(row.date))}
              </Text>
              <Text variant="amount" style={styles.tabular}>
                {formatMoney(row.amount, currency)}
              </Text>
            </View>
            {index < rows.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </ScrollView>

      {nextChargeLabel ? (
        <View style={styles.nextCharge}>
          <Text variant="metadata" color={colors.textSecondary}>
            {nextChargeLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>{children}</View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 260,
  },
  listContent: {
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  nextCharge: {
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
