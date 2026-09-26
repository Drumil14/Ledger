import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { BudgetProgress } from '@/components/budget-progress';
import { Divider } from '@/components/divider';
import { EmptyState } from '@/components/empty-state';
import { MoneyText, formatMoney } from '@/components/money-text';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { TransactionRow } from '@/components/transaction-row';
import { colors, duration, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { currentMonthKey, monthLabel, previousMonthKey } from '@/lib/month';
import { CategoryBar } from '@/features/insights/components/category-bar';
import { CumulativeChart } from '@/features/insights/components/cumulative-chart';
import { MonthSelector } from '@/features/insights/components/month-selector';
import { InsightsSkeleton } from '@/features/insights/insights-skeleton';
import { RecurringSummary } from '@/features/recurring/components/recurring-summary';
import { useInsights, type InsightsData } from '@/features/insights/use-insights';
import type { Transaction } from '@/types/transaction';

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export default function Insights() {
  const { push } = useRouter();
  const reduceMotion = useReducedMotion();
  const onOpenTransaction = (id: string) => {
    haptics.light();
    push(`/transaction/${id}`);
  };
  // A single fixed "now" for the whole screen so month math stays stable.
  const now = useMemo(() => new Date(), []);
  const [monthKey, setMonthKey] = useState(() => currentMonthKey(now));

  const { data, isLoading, isError, refetch } = useInsights(monthKey, now);

  if (isLoading) {
    return <InsightsSkeleton />;
  }

  if (isError || !data) {
    return (
      <Screen edges={['top']} style={styles.headerPad}>
        <PageHeader title="Insights" />
        <EmptyState
          title="Couldn’t load insights"
          description="Your transactions are safe. Try again in a moment."
          actionLabel="Try again"
          onAction={refetch}
        />
      </Screen>
    );
  }

  if (data.isEmptyOverall) {
    return (
      <Screen edges={['top']} style={styles.headerPad}>
        <PageHeader title="Insights" />
        <EmptyState
          title="Nothing to analyze yet."
          description="Add a few expenses and Ledger will start showing spending patterns."
          actionLabel="Add expense"
          onAction={() => push('/add-expense')}
        />
      </Screen>
    );
  }

  const entering = reduceMotion ? undefined : FadeIn.duration(duration.base);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <PageHeader title="Insights" />
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} now={now} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Keyed on the month so switching crossfades and re-animates the bars. */}
        <Animated.View key={monthKey} entering={entering} style={styles.sections}>
          {data.hasMonthData ? (
            <FullReport
              data={data}
              onOpenTransaction={onOpenTransaction}
              onSetBudget={() => push('/budget')}
            />
          ) : (
            <View style={styles.monthEmpty}>
              <Text variant="body" color={colors.textSecondary} center>
                No spending recorded in {data.monthName}.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Recurring is not month-scoped, so it sits outside the keyed block. */}
        <View style={styles.recurring}>
          <RecurringSummary now={now} onOpen={() => push('/recurring')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* Report body                                                                */
/* -------------------------------------------------------------------------- */

type ReportProps = {
  data: InsightsData;
  onOpenTransaction: (id: string) => void;
  onSetBudget: () => void;
};

function FullReport({ data, onOpenTransaction, onSetBudget }: ReportProps) {
  const { currency, monthName, isCurrentMonth } = data;
  const prevMonthName = monthLabel(previousMonthKey(data.monthKey)).split(' ')[0];
  const maxCategory = data.categoryTotals[0]?.total ?? 0;

  return (
    <>
      {/* Hero total + month-over-month */}
      <View style={styles.hero}>
        <MoneyText amount={data.spent} currency={currency} variant="display" />
        <Text variant="body" color={colors.textSecondary}>
          {isCurrentMonth ? 'Spent this month' : `Spent in ${monthName}`}
        </Text>
        <Text variant="metadata" color={colors.textSecondary} style={styles.heroCompare}>
          {monthOverMonthText(data, prevMonthName)}
        </Text>
      </View>

      <Divider />

      {/* Where it went */}
      <View style={styles.section}>
        <SectionHeader title="Where it went" />
        {data.categoryTotals.map((c, i) => (
          <CategoryBar
            key={c.category}
            category={c.category}
            amount={c.total}
            currency={currency}
            fraction={maxCategory > 0 ? c.total / maxCategory : 0}
            percent={c.percent}
            monthName={monthName}
            delay={i * 55}
          />
        ))}
      </View>

      {/* What changed */}
      {data.hasPreviousData ? (
        <>
          <Divider />
          <View style={styles.section}>
            <SectionHeader title="What changed" />
            <WhatChanged data={data} />
          </View>
        </>
      ) : null}

      <Divider />

      {/* Spending pace */}
      <View style={styles.section}>
        <SectionHeader title="Spending pace" />
        <SpendingPaceBlock data={data} prevMonthName={prevMonthName} />
        <View style={styles.chartWrap}>
          <CumulativeChart
            current={data.cumulative.current}
            previous={data.cumulative.previous}
            totalDays={data.cumulative.totalDays}
            accessibilityLabel={paceSummary(data, prevMonthName)}
          />
        </View>
      </View>

      <Divider />

      {/* Budget */}
      <View style={styles.section}>
        <SectionHeader title="Budget" />
        <BudgetBlock data={data} onSetBudget={onSetBudget} />
      </View>

      <Divider />

      {/* Largest purchases */}
      <View style={styles.section}>
        <SectionHeader title="Largest purchases" />
        {data.largest.map((t, index) => (
          <LargestRow
            key={t.id}
            transaction={t}
            currency={currency}
            isLast={index === data.largest.length - 1}
            onPress={() => onOpenTransaction(t.id)}
          />
        ))}
      </View>

      {/* Worth noticing */}
      {data.insights.length > 0 ? (
        <>
          <Divider />
          <View style={styles.section}>
            <SectionHeader title="Worth noticing" />
            <View style={styles.insightList}>
              {data.insights.map((insight, index) => (
                <Animated.View
                  key={insight.id}
                  entering={FadeInDown.duration(duration.base).delay(index * 60)}
                >
                  <Text variant="body" style={styles.insight}>
                    {insight.text}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-blocks                                                                 */
/* -------------------------------------------------------------------------- */

function WhatChanged({ data }: { data: InsightsData }) {
  // The most significant movements only — skip flat / sub-dollar noise.
  const movers = data.categoryComparison
    .filter((c) => c.direction !== 'same' && Math.abs(c.differenceAmount) >= 1)
    .slice(0, 4);

  if (movers.length === 0) {
    return (
      <Text variant="body" color={colors.textSecondary}>
        No notable category changes versus {monthLabel(previousMonthKey(data.monthKey)).split(' ')[0]}.
      </Text>
    );
  }

  return (
    <View style={styles.changeList}>
      {movers.map((c) => {
        const up = c.direction === 'up';
        const sign = up ? '+' : '−';
        const amount = formatMoney(Math.abs(c.differenceAmount), data.currency);
        return (
          <View
            key={c.category}
            style={styles.changeRow}
            accessibilityRole="text"
            accessibilityLabel={`${c.category}, ${up ? 'up' : 'down'} ${amount} versus last month.`}
          >
            <Text variant="rowTitle">{c.category}</Text>
            <Text variant="metadata" color={colors.textSecondary}>
              {sign}
              {amount} vs last month
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SpendingPaceBlock({ data, prevMonthName }: { data: InsightsData; prevMonthName: string }) {
  const { pace, currency, monthName, isCurrentMonth } = data;
  const hasPrev = pace.previousSpendToSameDay > 0;

  return (
    <View style={styles.paceBlock}>
      <View style={styles.paceItem}>
        <MoneyText amount={pace.currentSpendToDate} currency={currency} variant="amount" />
        <Text variant="metadata" color={colors.textSecondary}>
          {isCurrentMonth ? `Spent by ${monthName} ${pace.throughDay}` : `${monthName} total`}
        </Text>
      </View>

      {hasPrev ? (
        <>
          <View style={styles.paceItem}>
            <Text variant="rowTitle" color={colors.textSecondary}>
              {formatMoney(pace.previousSpendToSameDay, currency)}
            </Text>
            <Text variant="metadata" color={colors.textSecondary}>
              {isCurrentMonth ? 'At this point last month' : `${prevMonthName} total`}
            </Text>
          </View>
          <Text variant="body">{paceDeltaText(data)}</Text>
        </>
      ) : (
        <Text variant="body" color={colors.textSecondary}>
          No previous month to compare yet.
        </Text>
      )}
    </View>
  );
}

function BudgetBlock({ data, onSetBudget }: { data: InsightsData; onSetBudget: () => void }) {
  const { budget, currency, monthName, projection } = data;

  if (!budget.hasBudget) {
    return (
      <View style={styles.noBudget}>
        <Text variant="body" color={colors.textSecondary}>
          Set a monthly budget to see budget-based insights.
        </Text>
        <TextLink label="Set budget →" onPress={onSetBudget} />
      </View>
    );
  }

  return (
    <View style={styles.budgetBlock}>
      <BudgetProgress progress={budget.progress} />
      <View style={styles.budgetRow}>
        <Text variant="body">
          {budget.overBudget && budget.overAmount !== null
            ? `${formatMoney(budget.overAmount, currency)} over budget`
            : `${formatMoney(budget.remaining ?? 0, currency)} remaining`}
        </Text>
        {budget.percentUsed !== null ? (
          <Text variant="body" color={colors.textSecondary}>
            {budget.percentUsed}% used
          </Text>
        ) : null}
      </View>
      {projection.eligible && projection.projected !== null ? (
        <View style={styles.projection}>
          <Text variant="metadata" color={colors.textSecondary}>
            At your current pace
          </Text>
          <Text variant="rowTitle">~{formatMoney(projection.projected, currency)} projected</Text>
          <Text variant="metadata" color={colors.textSecondary}>
            for {monthName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LargestRow({
  transaction,
  currency,
  isLast,
  onPress,
}: {
  transaction: Transaction;
  currency: string;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${transaction.merchant}`}
      >
        <TransactionRow
          merchant={transaction.merchant}
          category={transaction.category}
          amount={transaction.amount}
          currency={currency}
          timeLabel={dateFormatter.format(new Date(transaction.date))}
        />
      </Pressable>
      {!isLast ? <Divider /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Copy helpers                                                               */
/* -------------------------------------------------------------------------- */

function monthOverMonthText(data: InsightsData, prevMonthName: string): string {
  if (!data.hasPreviousData) return 'No previous month to compare yet.';
  const { differencePercent, direction } = data.comparison;
  if (differencePercent === null || direction === 'same' || Math.abs(differencePercent) === 0) {
    return `About the same as ${prevMonthName}`;
  }
  const word = direction === 'up' ? 'more' : 'less';
  return `${Math.abs(differencePercent)}% ${word} than ${prevMonthName}`;
}

function paceDeltaText(data: InsightsData): string {
  const { pace, currency } = data;
  if (pace.direction === 'same' || pace.differenceAmount === 0) {
    return 'Right in line with last month.';
  }
  const word = pace.direction === 'up' ? 'higher' : 'lower';
  return `${formatMoney(Math.abs(pace.differenceAmount), currency)} ${word} than last month`;
}

function paceSummary(data: InsightsData, prevMonthName: string): string {
  const { pace, currency, monthName, isCurrentMonth } = data;
  const current = `${formatMoney(pace.currentSpendToDate, currency)} spent in ${monthName}${
    isCurrentMonth ? ` through day ${pace.throughDay}` : ''
  }`;
  if (pace.previousSpendToSameDay <= 0) {
    return `Cumulative spending chart. ${current}. No previous month to compare.`;
  }
  const compare = isCurrentMonth ? 'at the same point last month' : `for all of ${prevMonthName}`;
  return `Cumulative spending chart. ${current}, versus ${formatMoney(
    pace.previousSpendToSameDay,
    currency
  )} ${compare}.`;
}

const styles = StyleSheet.create({
  headerPad: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sections: {
    gap: spacing.xl,
  },
  recurring: {
    marginTop: spacing.xl,
  },
  monthEmpty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  hero: {
    gap: spacing.xs,
  },
  heroCompare: {
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  chartWrap: {
    marginTop: spacing.md,
  },
  changeList: {
    gap: spacing.md,
  },
  changeRow: {
    gap: 2,
  },
  paceBlock: {
    gap: spacing.md,
  },
  paceItem: {
    gap: 2,
  },
  noBudget: {
    gap: spacing.sm,
  },
  budgetBlock: {
    gap: spacing.md,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  projection: {
    gap: 2,
    marginTop: spacing.xs,
  },
  insightList: {
    gap: spacing.md,
  },
  insight: {
    lineHeight: 24,
  },
});
