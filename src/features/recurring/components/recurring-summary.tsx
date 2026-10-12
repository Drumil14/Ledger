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
 *
 * One primary figure (monthly recurring) with its yearly equivalent, then — only
 * when something actually needs attention — a grouped Review prompt, so the action
 * reads as part of the candidate note rather than a free-floating control.
 */
export function RecurringSummary({ now, onOpen }: Props) {
  const { data } = useRecurring(now);
  if (!data || data.isEmpty) return null;

  const hasConfirmed = data.confirmed.length > 0;
  const candidateCount = data.candidates.length;

  return (
    <View style={styles.block}>
      <Divider />
      <View style={styles.section}>
        <SectionHeader title="Recurring" actionLabel="Manage" onAction={onOpen} />

        {hasConfirmed ? (
          <View style={styles.metric}>
            <Text variant="eyebrow" color={colors.textSecondary}>
              MONTHLY RECURRING
            </Text>
            <MoneyText
              amount={data.monthlyTotal}
              currency={data.currency}
              variant="display"
              style={styles.metricNumber}
            />
            <Text variant="metadata" color={colors.textSecondary}>
              ≈ {formatMoney(data.annualEstimate, data.currency)} a year
            </Text>
          </View>
        ) : null}

        {candidateCount > 0 ? (
          <View style={styles.candidate}>
            <Text variant="body" color={colors.textSecondary}>
              {candidateCount === 1
                ? '1 potential recurring expense detected.'
                : `${candidateCount} potential recurring expenses detected.`}
            </Text>
            <TextLink label="Review →" onPress={onOpen} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 0,
  },
  section: {
    // Generous breathing room between the hairline and the heading.
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  metric: {
    gap: spacing.xs,
  },
  metricNumber: {
    // Matches the "Looking ahead" metric so the two regions share a rhythm.
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  candidate: {
    gap: spacing.xs,
  },
});
