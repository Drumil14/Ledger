import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BudgetProgress } from '@/components/budget-progress';
import { Divider } from '@/components/divider';
import { EmptyState } from '@/components/empty-state';
import { MoneyText, formatMoney } from '@/components/money-text';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SpendingChart } from '@/components/spending-chart';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { TransactionRow } from '@/components/transaction-row';
import { colors, duration, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { DayExpensesSheet } from '@/features/home/day-expenses-sheet';
import { getDaySummary } from '@/features/home/day-summary';
import { HomeSkeleton } from '@/features/home/home-skeleton';
import { useHomeOverview } from '@/features/home/use-home-overview';
import { useTransactionsQuery } from '@/features/transactions/queries';
import type { ChartPoint } from '@/features/home/overview';

// Hoisted: expensive to construct, and locale/options are static.
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

export default function Home() {
  const { push } = useRouter();
  const { data, isLoading, isError, refetch } = useHomeOverview();
  // Same cached list Home already loaded — no refetch when a bar is tapped.
  const { data: allTransactions } = useTransactionsQuery();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const daySummary = useMemo(
    () =>
      selectedKey && allTransactions
        ? getDaySummary(allTransactions, new Date(Number(selectedKey)))
        : null,
    [selectedKey, allTransactions]
  );

  const onSelectDay = (point: ChartPoint) => setSelectedKey(point.key);
  const onSelectDayTransaction = (id: string) => {
    // Dismiss the sheet (a native Modal) before presenting the detail modal.
    setSelectedKey(null);
    setTimeout(() => push(`/transaction/${id}`), duration.base);
  };

  if (isLoading) {
    return <HomeSkeleton />;
  }

  if (isError || !data) {
    return (
      <Screen edges={['top']}>
        <EmptyState
          title="Couldn’t load your spending"
          description={toUserMessage(new Error('network'))}
          actionLabel="Try again"
          onAction={refetch}
        />
      </Screen>
    );
  }

  if (data.isEmpty) {
    return (
      <Screen edges={['top']}>
        <EmptyState
          title="No spending yet."
          description="Add your first expense and Ledger will start building your month."
          actionLabel="Add expense"
          onAction={() => push('/add-expense')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="eyebrow" color={colors.textSecondary} style={styles.month}>
          {data.monthLabel.toUpperCase()}
        </Text>

        <Animated.View entering={FadeInDown.duration(duration.slow)} style={styles.hero}>
          <MoneyText amount={data.spent} currency={data.currency} variant="display" />
          <Text variant="body" color={colors.textSecondary}>
            Spent this month
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(duration.slow).delay(70)}>
          {data.hasBudget && data.limit !== null ? (
            <Pressable
              onPress={() => push('/budget')}
              style={styles.budget}
              accessibilityRole="button"
              accessibilityLabel="Edit budget"
            >
              <BudgetProgress progress={data.progress} />
              <View style={styles.budgetRow}>
                <Text variant="metadata" color={colors.textSecondary}>
                  {data.overBudget && data.overAmount !== null
                    ? `${formatMoney(data.overAmount, data.currency)} over budget`
                    : `${formatMoney(data.remaining ?? 0, data.currency)} remaining of ${formatMoney(data.limit, data.currency)}`}
                </Text>
                {data.percentUsed !== null ? (
                  <Text variant="metadata" color={colors.textSecondary}>
                    {data.percentUsed}% used
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : (
            <View style={styles.noBudget}>
              <Text variant="body" color={colors.textSecondary}>
                Set a monthly budget to understand how much you have left to spend.
              </Text>
              <TextLink label="Set budget →" onPress={() => push('/budget')} />
            </View>
          )}
        </Animated.View>

        <Divider />

        <View style={styles.section}>
          <SectionHeader title="Spending" />
          <SpendingChart data={data.chart} selectedKey={selectedKey} onSelectDay={onSelectDay} />
        </View>

        <Divider />

        <View style={styles.section}>
          <SectionHeader title="Today" />
          {data.today.length > 0 ? (
            data.today.map((t, index) => (
              <Animated.View
                key={t.id}
                entering={FadeInDown.duration(duration.base).delay(index * 60)}
              >
                <Pressable
                  onPress={() => push(`/transaction/${t.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${t.merchant}`}
                >
                  <TransactionRow
                    merchant={t.merchant}
                    category={t.category}
                    amount={t.amount}
                    currency={t.currency}
                    timeLabel={timeFormatter.format(new Date(t.date))}
                  />
                </Pressable>
                {index < data.today.length - 1 ? <Divider /> : null}
              </Animated.View>
            ))
          ) : (
            <Text variant="body" color={colors.textSecondary}>
              Nothing spent today.
            </Text>
          )}
        </View>

        <View style={styles.viewAll}>
          <TextLink label="View all transactions →" onPress={() => push('/transactions')} />
        </View>
      </ScrollView>

      <DayExpensesSheet
        summary={daySummary}
        currency={data.currency}
        onClose={() => setSelectedKey(null)}
        onSelectTransaction={onSelectDayTransaction}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  month: {
    marginBottom: -spacing.md,
  },
  hero: {
    gap: spacing.xs,
  },
  budget: {
    gap: spacing.md,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  noBudget: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  viewAll: {
    paddingTop: spacing.sm,
  },
});
