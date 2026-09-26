import { StyleSheet, View } from 'react-native';

import { Divider } from '@/components/divider';
import { MoneyText, formatMoney } from '@/components/money-text';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { colors, spacing } from '@/constants/theme';
import { useRecurring } from '@/features/recurring/use-recurring';

type Props = {
  /** Fixed "now" shared with the host screen so derivation stays stable. */
  now: Date;
  onOpen: () => void;
};

/**
 * Compact recurring summary for the Insights screen. Independent of the selected
 * month (recurring spend isn't month-scoped). Renders nothing until there's
 * something to show, so it never disturbs an otherwise-empty report.
 */
export function RecurringSummary({ now, onOpen }: Props) {
  const { data } = useRecurring(now);
  if (!data || data.isEmpty) return null;

  const hasConfirmed = data.confirmed.length > 0;
  const candidateCount = data.candidates.length;

  return (
    <>
      <Divider />
      <View style={styles.section}>
        <SectionHeader title="Recurring" actionLabel="Manage" onAction={onOpen} />

        {hasConfirmed ? (
          <View style={styles.totalBlock}>
            <View style={styles.row}>
              <Text variant="body" color={colors.textSecondary}>
                Confirmed monthly recurring
              </Text>
              <MoneyText amount={data.monthlyTotal} currency={data.currency} />
            </View>
            <Text variant="metadata" color={colors.textSecondary}>
              Estimated yearly {formatMoney(data.annualEstimate, data.currency)}
            </Text>
          </View>
        ) : null}

        {candidateCount > 0 ? (
          <View style={styles.candidateRow}>
            <Text variant="body" color={colors.textSecondary}>
              {candidateCount === 1
                ? '1 potential recurring expense detected.'
                : `${candidateCount} potential recurring expenses detected.`}
            </Text>
            <TextLink label="Review →" onPress={onOpen} />
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  totalBlock: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  candidateRow: {
    gap: spacing.sm,
  },
});
