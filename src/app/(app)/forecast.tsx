import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Divider } from '@/components/divider';
import { ModalHeader } from '@/components/modal-header';
import { MoneyText, formatMoney } from '@/components/money-text';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { colors, duration, spacing } from '@/constants/theme';
import { centsToAmount } from '@/lib/money';
import { useAsOf } from '@/lib/use-as-of';
import { ForecastChart } from '@/features/forecast/components/forecast-chart';
import { HorizonToggle } from '@/features/forecast/components/horizon-toggle';
import { WarningNotice } from '@/features/forecast/components/warning-notice';
import { useForecast } from '@/features/forecast/use-forecast';
import {
  buildForecastChart,
  confidenceCopy,
  forecastA11ySummary,
  groupForecastEvents,
  horizonForId,
  type ForecastHorizonId,
} from '@/features/forecast/view-model';
import type { ForecastEvent, ForecastResult } from '@/features/forecast/types';

const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function ForecastScreen() {
  const { back, push } = useRouter();
  const reduceMotion = useReducedMotion();

  const now = useAsOf();
  const [horizonId, setHorizonId] = useState<ForecastHorizonId>('days-30');
  const horizon = useMemo(() => horizonForId(horizonId), [horizonId]);

  const { data, isLoading, isError, isEmpty, currencyMismatch, mismatchCurrencies, refetch } =
    useForecast({ asOf: now, horizon });

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Forecast" onClose={back} />

      <View style={styles.toggle}>
        <HorizonToggle value={horizonId} onChange={setHorizonId} />
      </View>

      {isLoading ? (
        <Centered>
          <Text variant="body" color={colors.textSecondary}>
            Projecting your cash flow…
          </Text>
        </Centered>
      ) : currencyMismatch ? (
        <CurrencyMismatch currencies={mismatchCurrencies} />
      ) : isError ? (
        <Centered>
          <Text variant="sectionTitle" center>
            Couldn’t build your forecast
          </Text>
          <Text variant="body" color={colors.textSecondary} center style={styles.centeredCopy}>
            Your data is safe. Try again in a moment.
          </Text>
          <View style={styles.centeredAction}>
            <PrimaryButton label="Try again" onPress={refetch} />
          </View>
        </Centered>
      ) : isEmpty || !data ? (
        <EmptyForecast onAddIncome={() => push('/income')} onSetBalance={() => push('/balance')} />
      ) : (
        <Animated.ScrollView
          entering={reduceMotion ? undefined : FadeIn.duration(duration.base)}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ForecastBody
            data={data}
            onManageIncome={() => push('/income')}
            onUpdateBalance={() => push('/balance')}
          />
        </Animated.ScrollView>
      )}
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* Body                                                                       */
/* -------------------------------------------------------------------------- */

function ForecastBody({
  data,
  onManageIncome,
  onUpdateBalance,
}: {
  data: ForecastResult;
  onManageIncome: () => void;
  onUpdateBalance: () => void;
}) {
  const currency = data.currency;
  const money = (amount: number) => formatMoney(amount, currency);
  const groups = useMemo(() => groupForecastEvents(data), [data]);
  const chart = useMemo(() => buildForecastChart(data), [data]);
  const confidence = confidenceCopy(data.confidence);

  const net = centsToAmount(data.netChangeCents);
  const positive = data.netChangeCents >= 0;
  const periodLabel = `Through ${longDate.format(parseKey(data.horizonEnd))}`;

  return (
    <>
      {/* Hero: expected net cash flow */}
      <View style={styles.hero}>
        <Text variant="eyebrow" color={colors.textSecondary}>
          EXPECTED NET CASH FLOW
        </Text>
        <MoneyText amount={net} currency={currency} variant="display" showSign={!positive} />
        <Text variant="body" color={colors.textSecondary}>
          {positive ? 'Expected surplus' : 'Expected shortfall'} · {periodLabel}
        </Text>
      </View>

      {/* Projected balance. Shown only when anchored to a balance the user
          declared FOR today — an earlier snapshot is never rolled forward into a
          "current" balance, so this is always a real, self-declared figure. */}
      {data.projectedBalanceCents !== null ? (
        <View style={styles.balance}>
          <View style={styles.balanceRow}>
            <Text variant="body" color={colors.textSecondary}>
              Projected balance {shortDate.format(parseKey(data.horizonEnd))}
            </Text>
            <MoneyText amount={centsToAmount(data.projectedBalanceCents)} currency={currency} variant="amount" />
          </View>
          {data.balanceAsOfDate ? (
            <Text variant="metadata" color={colors.textSecondary}>
              From the balance you entered on {longDate.format(parseKey(data.balanceAsOfDate))}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Chart */}
      <View style={styles.chartWrap}>
        <ForecastChart
          chart={chart}
          currency={currency}
          accessibilityLabel={forecastA11ySummary(data, money)}
        />
      </View>

      {/* Confidence */}
      <View style={styles.confidence}>
        <Text variant="rowTitle">{confidence.label}</Text>
        <Text variant="metadata" color={colors.textSecondary}>
          {confidence.description}
        </Text>
      </View>

      <WarningNotice warnings={data.warnings} />

      {/* Scheduled income */}
      {groups.income.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Scheduled income" />
          <EventList events={groups.income} currency={currency} />
          <TotalRow label="Total income" amountCents={groups.incomeTotalCents} currency={currency} />
        </View>
      ) : null}

      {/* Upcoming recurring expenses */}
      {groups.recurring.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Upcoming recurring" />
          <EventList events={groups.recurring} currency={currency} />
          <TotalRow label="Total recurring" amountCents={groups.recurringTotalCents} currency={currency} />
        </View>
      ) : null}

      {/* Estimated discretionary spending */}
      <View style={styles.section}>
        <SectionHeader title="Estimated spending" />
        {groups.estimatedDailyCents > 0 ? (
          <View style={styles.estimateBlock}>
            <View style={styles.row}>
              <View style={styles.estimateLeft}>
                <Text variant="rowTitle">Discretionary</Text>
                <Text variant="metadata" color={colors.textSecondary}>
                  ESTIMATED · ~{money(centsToAmount(groups.estimatedDailyCents))}/day from your history
                </Text>
              </View>
              <Text variant="amount" style={styles.tabular}>
                −{money(centsToAmount(Math.abs(groups.estimatedTotalCents)))}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="body" color={colors.textSecondary}>
            Not enough spending history yet to estimate day-to-day spending.
          </Text>
        )}
      </View>

      <Divider />

      <View style={styles.actions}>
        <SecondaryButton label="Manage income" onPress={onManageIncome} />
        <SecondaryButton label="Update balance" onPress={onUpdateBalance} />
      </View>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Event rows                                                                 */
/* -------------------------------------------------------------------------- */

function EventList({ events, currency }: { events: ForecastEvent[]; currency: string }) {
  return (
    <View>
      {events.map((e, index) => {
        const positive = e.amountCents >= 0;
        const amount = formatMoney(centsToAmount(Math.abs(e.amountCents)), currency);
        return (
          <View key={`${e.date}-${e.label}-${index}`}>
            <View
              style={styles.eventRow}
              accessibilityRole="text"
              accessibilityLabel={`${e.label}, ${positive ? 'plus' : 'minus'} ${amount}, ${longDate.format(
                parseKey(e.date)
              )}`}
            >
              <View style={styles.eventLeft}>
                <Text variant="rowTitle" numberOfLines={1}>
                  {e.label}
                </Text>
                <Text variant="metadata" color={colors.textSecondary}>
                  {shortDate.format(parseKey(e.date))}
                </Text>
              </View>
              <Text variant="amount" style={styles.tabular}>
                {positive ? '+' : '−'}
                {amount}
              </Text>
            </View>
            {index < events.length - 1 ? <Divider /> : null}
          </View>
        );
      })}
    </View>
  );
}

function TotalRow({
  label,
  amountCents,
  currency,
}: {
  label: string;
  amountCents: number;
  currency: string;
}) {
  const positive = amountCents >= 0;
  return (
    <View style={styles.totalRow}>
      <Text variant="metadata" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="metadata" color={colors.textSecondary} style={styles.tabular}>
        {positive ? '+' : '−'}
        {formatMoney(centsToAmount(Math.abs(amountCents)), currency)}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function EmptyForecast({
  onAddIncome,
  onSetBalance,
}: {
  onAddIncome: () => void;
  onSetBalance: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text variant="sectionTitle" center>
        Forecast your cash flow
      </Text>
      <Text variant="body" color={colors.textSecondary} center style={styles.emptyCopy}>
        Add your income and a current balance, and Ledger will project where your money is headed.
      </Text>
      <View style={styles.emptyActions}>
        <PrimaryButton label="Add income" onPress={onAddIncome} />
        <SecondaryButton label="Enter balance" onPress={onSetBalance} />
      </View>
    </View>
  );
}

function CurrencyMismatch({ currencies }: { currencies: string[] }) {
  return (
    <View style={styles.empty}>
      <Text variant="sectionTitle" center>
        Multiple currencies
      </Text>
      <Text variant="body" color={colors.textSecondary} center style={styles.emptyCopy}>
        Your income, balance and transactions use more than one currency ({currencies.join(', ')}).
        Ledger won’t combine currencies, so a single forecast isn’t available. Use one currency to see
        your projection.
      </Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  toggle: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.xs,
  },
  balance: {
    gap: spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chartWrap: {
    marginTop: spacing.xs,
  },
  confidence: {
    gap: 2,
  },
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  eventLeft: {
    flex: 1,
    gap: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  estimateBlock: {
    gap: spacing.sm,
  },
  estimateLeft: {
    flex: 1,
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  actions: {
    gap: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyCopy: {
    maxWidth: 320,
  },
  emptyActions: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  centeredCopy: {
    maxWidth: 300,
  },
  centeredAction: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
