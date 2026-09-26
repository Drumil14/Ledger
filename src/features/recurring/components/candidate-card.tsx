import { Pressable, StyleSheet, View } from 'react-native';

import { MoneyText } from '@/components/money-text';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { colors, hairline, radius, spacing } from '@/constants/theme';
import type { RecurringCandidate } from '@/features/recurring/detection';
import { describeAmount, frequencyAdverb, intervalPhrase } from '@/features/recurring/summary';

type Props = {
  candidate: RecurringCandidate;
  currency: string;
  onOpen: () => void;
  onConfirm: () => void;
  onIgnore: () => void;
  /** Disables actions while a decision is in flight. */
  busy?: boolean;
};

/**
 * A potential recurring expense: the merchant, its amount, factual evidence, and
 * the two decisions. Language stays descriptive — no confidence score is shown.
 */
export function CandidateCard({ candidate, currency, onOpen, onConfirm, onIgnore, busy }: Props) {
  const { merchant, expectedAmount, occurrences, frequency } = candidate;
  const evidence = `You've paid this ${occurrences} times, ${intervalPhrase(frequency)}.`;

  const a11yLabel = `${merchant}, ${describeAmount(expectedAmount)}, detected ${occurrences} times ${frequencyAdverb(
    frequency
  )}. Double tap to see the detected pattern.`;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={styles.info}
      >
        <View style={styles.headline}>
          <Text variant="rowTitle" numberOfLines={1} style={styles.merchant}>
            {merchant}
          </Text>
          <MoneyText amount={expectedAmount} currency={currency} />
        </View>
        <Text variant="metadata" color={colors.textSecondary}>
          {evidence}
        </Text>
      </Pressable>

      <View style={styles.actions}>
        <PrimaryButton label="Confirm" onPress={onConfirm} disabled={busy} />
        <SecondaryButton label="Not recurring" onPress={onIgnore} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: hairline,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  info: {
    gap: spacing.xs,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  merchant: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
  },
});
