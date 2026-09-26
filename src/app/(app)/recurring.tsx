import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { Divider } from '@/components/divider';
import { EmptyState } from '@/components/empty-state';
import { ModalHeader } from '@/components/modal-header';
import { MoneyText, formatMoney } from '@/components/money-text';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { colors, duration, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { RecurringCandidate } from '@/features/recurring/detection';
import { CandidateCard } from '@/features/recurring/components/candidate-card';
import { PatternSheet, type PatternRow } from '@/features/recurring/components/pattern-sheet';
import {
  useConfirmRecurring,
  useDeleteRecurring,
  useIgnoreRecurring,
} from '@/features/recurring/queries';
import { describeAmount, frequencyLabel } from '@/features/recurring/summary';
import {
  useRecurring,
  type ConfirmedRecurring,
  type RecurringData,
} from '@/features/recurring/use-recurring';
import { useTransactionsQuery } from '@/features/transactions/queries';
import type { UpsertRecurringInput } from '@/services/recurring';
import type { Transaction } from '@/types/transaction';

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** Parse a `YYYY-MM-DD` key as a local date (avoids UTC off-by-one), then format. */
function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function candidateToInput(candidate: RecurringCandidate): UpsertRecurringInput {
  return {
    merchant: candidate.merchant,
    normalizedMerchant: candidate.normalizedMerchant,
    expectedAmount: candidate.expectedAmount,
    frequency: candidate.frequency,
    nextExpectedDate: candidate.nextExpectedDate,
    lastTransactionId: candidate.lastTransactionId,
  };
}

type SheetState =
  | { kind: 'candidate'; candidate: RecurringCandidate }
  | { kind: 'confirmed'; item: ConfirmedRecurring }
  | null;

export default function RecurringScreen() {
  const { back } = useRouter();
  const reduceMotion = useReducedMotion();
  const now = useMemo(() => new Date(), []);

  const { data, isLoading, isError, refetch } = useRecurring(now);
  const transactions = useTransactionsQuery();
  const confirm = useConfirmRecurring();
  const ignore = useIgnoreRecurring();
  const remove = useDeleteRecurring();

  const [sheet, setSheet] = useState<SheetState>(null);

  const txById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const t of transactions.data ?? []) map.set(t.id, t);
    return map;
  }, [transactions.data]);

  const onConfirm = (candidate: RecurringCandidate) => {
    haptics.success();
    confirm.mutate(candidateToInput(candidate));
    setSheet(null);
  };

  const onIgnore = (candidate: RecurringCandidate) => {
    haptics.selection();
    ignore.mutate(candidateToInput(candidate));
    setSheet(null);
  };

  const onRemove = (item: ConfirmedRecurring) => {
    haptics.warning();
    remove.mutate(item.record.id);
    setSheet(null);
  };

  const busy = confirm.isPending || ignore.isPending;
  const layout = reduceMotion ? undefined : LinearTransition.duration(duration.base);

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Recurring" onClose={back} />

      {isLoading ? (
        <Centered>
          <Text variant="body" color={colors.textSecondary}>
            Loading…
          </Text>
        </Centered>
      ) : isError || !data ? (
        <EmptyState
          title="Couldn’t load recurring"
          description="Your transactions are safe. Try again in a moment."
          actionLabel="Try again"
          onAction={refetch}
        />
      ) : data.isEmpty ? (
        <EmptyState
          title="No recurring expenses yet."
          description="Ledger will start detecting patterns as you build transaction history."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.confirmed.length > 0 ? (
            <ConfirmedSection
              data={data}
              layout={layout}
              onOpen={(item) => {
                haptics.light();
                setSheet({ kind: 'confirmed', item });
              }}
            />
          ) : null}

          {data.confirmed.length > 0 && data.candidates.length > 0 ? <Divider /> : null}

          {data.candidates.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Potential recurring" />
              <Animated.View style={styles.candidateList} layout={layout}>
                {data.candidates.map((candidate) => (
                  <Animated.View
                    key={candidate.normalizedMerchant}
                    entering={reduceMotion ? undefined : FadeIn.duration(duration.base)}
                    exiting={reduceMotion ? undefined : FadeOut.duration(duration.fast)}
                    layout={layout}
                  >
                    <CandidateCard
                      candidate={candidate}
                      currency={data.currency}
                      busy={busy}
                      onOpen={() => {
                        haptics.light();
                        setSheet({ kind: 'candidate', candidate });
                      }}
                      onConfirm={() => onConfirm(candidate)}
                      onIgnore={() => onIgnore(candidate)}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Candidate detail — shows the detected pattern + the two decisions. */}
      <PatternSheet
        visible={sheet?.kind === 'candidate'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'candidate' ? sheet.candidate.merchant : ''}
        meta={
          sheet?.kind === 'candidate'
            ? `${frequencyLabel(sheet.candidate.frequency)} · detected ${sheet.candidate.occurrences} times`
            : ''
        }
        rows={sheet?.kind === 'candidate' ? candidateRows(sheet.candidate, txById) : []}
        currency={data?.currency ?? 'USD'}
      >
        {sheet?.kind === 'candidate' ? (
          <>
            <PrimaryButton
              label="Confirm recurring"
              onPress={() => onConfirm(sheet.candidate)}
              disabled={busy}
            />
            <SecondaryButton
              label="Not recurring"
              onPress={() => onIgnore(sheet.candidate)}
              disabled={busy}
            />
          </>
        ) : null}
      </PatternSheet>

      {/* Confirmed detail — matching charges, next estimate, and remove. */}
      <PatternSheet
        visible={sheet?.kind === 'confirmed'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'confirmed' ? sheet.item.record.merchant : ''}
        meta={
          sheet?.kind === 'confirmed'
            ? `${frequencyLabel(sheet.item.record.frequency)} · ${sheet.item.transactions.length} charges`
            : ''
        }
        rows={
          sheet?.kind === 'confirmed'
            ? sheet.item.transactions.map((t) => ({ id: t.id, date: t.date, amount: t.amount }))
            : []
        }
        currency={data?.currency ?? 'USD'}
        nextChargeLabel={
          sheet?.kind === 'confirmed' && sheet.item.nextExpectedDate
            ? `Expected around ${formatDateKey(sheet.item.nextExpectedDate)}`
            : undefined
        }
      >
        {sheet?.kind === 'confirmed' ? (
          <SecondaryButton
            label="Remove recurring"
            onPress={() => onRemove(sheet.item)}
            disabled={remove.isPending}
          />
        ) : null}
      </PatternSheet>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmed section                                                          */
/* -------------------------------------------------------------------------- */

function ConfirmedSection({
  data,
  layout,
  onOpen,
}: {
  data: RecurringData;
  layout: ReturnType<typeof LinearTransition.duration> | undefined;
  onOpen: (item: ConfirmedRecurring) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.hero}>
        <MoneyText amount={data.monthlyTotal} currency={data.currency} variant="display" />
        <Text variant="body" color={colors.textSecondary}>
          Monthly recurring
        </Text>
        <Text variant="metadata" color={colors.textSecondary} style={styles.estimate}>
          Estimated yearly {formatMoney(data.annualEstimate, data.currency)}
        </Text>
      </View>

      <Divider />

      <Animated.View layout={layout}>
        {data.confirmed.map((item, index) => (
          <Animated.View
            key={item.record.id}
            layout={layout}
            entering={undefined}
            exiting={undefined}
          >
            <ConfirmedRow
              item={item}
              currency={data.currency}
              isLast={index === data.confirmed.length - 1}
              onPress={() => onOpen(item)}
            />
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

function ConfirmedRow({
  item,
  currency,
  isLast,
  onPress,
}: {
  item: ConfirmedRecurring;
  currency: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const { record } = item;
  const amount = record.expectedAmount ?? 0;
  const a11yLabel = `${record.merchant}, ${describeAmount(amount)}, ${frequencyLabel(
    record.frequency
  ).toLowerCase()}. Double tap for details.`;

  return (
    <View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel}>
        <View style={styles.confirmedRow}>
          <View style={styles.confirmedLeft}>
            <Text variant="rowTitle" numberOfLines={1}>
              {record.merchant}
            </Text>
            <Text variant="metadata" color={colors.textSecondary}>
              {frequencyLabel(record.frequency)}
            </Text>
          </View>
          <MoneyText amount={amount} currency={currency} />
        </View>
      </Pressable>
      {!isLast ? <Divider /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function candidateRows(
  candidate: RecurringCandidate,
  txById: Map<string, Transaction>
): PatternRow[] {
  return candidate.transactionIds
    .map((id) => txById.get(id))
    .filter((t): t is Transaction => t !== undefined)
    .map((t) => ({ id: t.id, date: t.date, amount: t.amount }));
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  hero: {
    gap: spacing.xs,
  },
  estimate: {
    marginTop: spacing.xs,
  },
  candidateList: {
    gap: spacing.md,
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  confirmedLeft: {
    flex: 1,
    gap: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
