import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Divider } from '@/components/divider';
import { MoneyText } from '@/components/money-text';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { colors, spacing } from '@/constants/theme';
import { centsToAmount } from '@/lib/money';
import { useForecast } from '@/features/forecast/use-forecast';
import type { ForecastResult } from '@/features/forecast/types';

type Props = {
  /** Fixed "now" shared with the host screen so derivation stays stable. */
  now: Date;
  onOpen: () => void;
};

const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Forward-looking preview for Insights. One clearly-defined region: a prominent
 * next-30-day net cash-flow figure, an aligned projected-balance line (with its
 * provenance), and calm prompts when income or a current balance is missing.
 * Mirrors `RecurringSummary`: self-contained, renders nothing until data is ready.
 */
export function ForecastSummary({ now, onOpen }: Props) {
  const horizon = useMemo(() => ({ kind: 'days', days: 30 }) as const, []);
  const { data, isLoading, currencyMismatch } = useForecast({ asOf: now, horizon });

  if (isLoading) return null;

  return (
    <View style={styles.block}>
      <Divider />
      <View style={styles.section}>
        <SectionHeader title="Looking ahead" actionLabel="Forecast" onAction={onOpen} />

        {currencyMismatch ? (
          <Text variant="body" color={colors.textSecondary}>
            Your accounts use more than one currency, so a combined forecast isn’t available.
          </Text>
        ) : !data ? null : (
          <Body data={data} onOpen={onOpen} />
        )}
      </View>
    </View>
  );
}

function Body({ data, onOpen }: { data: ForecastResult; onOpen: () => void }) {
  const { netChangeCents, projectedBalanceCents, currency, balanceAsOfDate } = data;
  const net = centsToAmount(netChangeCents);
  const positive = netChangeCents >= 0;
  const needsIncome = data.warnings.includes('missing-income');

  return (
    <View style={styles.body}>
      {/* Primary metric — net cash flow over the next 30 days */}
      <View style={styles.metric}>
        <Text variant="eyebrow" color={colors.textSecondary}>
          NET CASH FLOW · NEXT 30 DAYS
        </Text>
        <MoneyText
          amount={net}
          currency={currency}
          variant="display"
          showSign={!positive}
          style={styles.metricNumber}
        />
        <Text variant="metadata" color={colors.textSecondary}>
          {positive ? 'Expected surplus' : 'Expected shortfall'}
        </Text>
      </View>

      {/* Secondary metric — projected ending balance, or a prompt to enable it */}
      {projectedBalanceCents !== null ? (
        <View style={styles.detail}>
          <View style={styles.detailRow}>
            <Text variant="body" color={colors.textSecondary} style={styles.detailLabel}>
              Projected balance
            </Text>
            <MoneyText amount={centsToAmount(projectedBalanceCents)} currency={currency} />
          </View>
          {balanceAsOfDate ? (
            <Text variant="metadata" color={colors.textSecondary}>
              From the balance you entered on {longDate.format(parseKey(balanceAsOfDate))}
            </Text>
          ) : null}
        </View>
      ) : (
        <Prompt
          text="Add a current balance to project your ending balance."
          actionLabel="Set up →"
          onPress={onOpen}
        />
      )}

      {needsIncome ? (
        <Prompt
          text="Add income to forecast your full cash flow."
          actionLabel="Add income →"
          onPress={onOpen}
        />
      ) : null}
    </View>
  );
}

function Prompt({
  text,
  actionLabel,
  onPress,
}: {
  text: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.prompt}>
      <Text variant="metadata" color={colors.textSecondary}>
        {text}
      </Text>
      <TextLink label={actionLabel} onPress={onPress} />
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
  },
  body: {
    gap: spacing.lg,
  },
  metric: {
    gap: spacing.xs,
  },
  metricNumber: {
    // Prominent, but a step below the month hero so it never competes with it.
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  detail: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    flex: 1,
  },
  prompt: {
    gap: spacing.xs,
  },
});
