import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { BudgetProgress } from '@/components/budget-progress';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { Divider } from '@/components/divider';
import { ModalHeader } from '@/components/modal-header';
import { PrimaryButton, type ButtonState } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/components/money-text';
import { amountToInput, centsToAmount, parseAmountToCents } from '@/lib/money';
import { currentMonthKey, monthKeyFromStored, monthLabel } from '@/lib/month';
import { FormError } from '@/features/auth/components/form-error';
import { AmountInput } from '@/features/transactions/components/amount-input';
import {
  useBudgetHistoryQuery,
  useBudgetQuery,
  useDeleteBudget,
  useUpsertBudget,
} from '@/features/budgets/queries';
import { budgetFormSchema, budgetFormToLimit, type BudgetFormValues } from '@/features/budgets/schema';
import { computeBudgetStatus, sumSpendingForMonth } from '@/features/budgets/summary';
import { useTransactionsQuery } from '@/features/transactions/queries';

export default function BudgetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string }>();
  const monthKey = params.month ?? currentMonthKey();

  const budget = useBudgetQuery(monthKey);
  const transactions = useTransactionsQuery();
  const history = useBudgetHistoryQuery();
  const { mutateAsync: saveBudget } = useUpsertBudget();
  const { mutate: removeBudget } = useDeleteBudget();

  const [saveState, setSaveState] = useState<ButtonState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const existing = budget.data ?? null;
  const currency = existing?.currency ?? 'USD';
  const spent = sumSpendingForMonth(transactions.data ?? [], monthKey);

  // `values` keeps the form in sync with the loaded budget while preserving edits.
  const { control, handleSubmit, setValue } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    values: { amount: existing ? amountToInput(existing.limit) : '' },
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  });

  const typed = useWatch({ control, name: 'amount' }) ?? '';
  const typedCents = parseAmountToCents(typed);
  const previewLimit = typedCents !== null ? centsToAmount(typedCents) : null;
  const status = computeBudgetStatus(previewLimit, spent);

  // Most recent budget from another month (for "use last month").
  const lastBudget = (history.data ?? []).find((b) => monthKeyFromStored(b.month) !== monthKey);
  const previous = (history.data ?? []).filter((b) => monthKeyFromStored(b.month) !== monthKey);

  const onSave = handleSubmit(
    async (values) => {
      setSaveError(null);
      setSaveState('loading');
      try {
        await saveBudget({ monthKey, limit: budgetFormToLimit(values), currency });
        setSaveState('success');
        haptics.success();
        setTimeout(() => router.back(), 260);
      } catch (e) {
        setSaveState('idle');
        setSaveError(toUserMessage(e));
        haptics.error();
      }
    },
    () => haptics.warning()
  );

  const onConfirmRemove = () => {
    setConfirming(false);
    haptics.warning();
    removeBudget(monthKey);
    router.back();
  };

  const a11yLabel =
    status.hasBudget && status.limit !== null
      ? `Monthly budget ${formatMoney(status.limit, currency)}. Spent ${formatMoney(spent, currency)}. ${
          status.overBudget && status.overAmount !== null
            ? `${formatMoney(status.overAmount, currency)} over budget`
            : `${formatMoney(status.remaining ?? 0, currency)} remaining`
        }. ${status.percentUsed ?? 0} percent used.`
      : `Spent ${formatMoney(spent, currency)}. No budget set.`;

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Budget" onClose={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="pageTitle">{monthLabel(monthKey)}</Text>

          <View style={styles.limitBlock}>
            <Text variant="metadata" color={colors.textSecondary} style={styles.label}>
              Monthly limit
            </Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange }, fieldState }) => (
                <>
                  <AmountInput value={value} onChangeText={onChange} />
                  {fieldState.error ? (
                    <Text variant="metadata" color={colors.primary} center>
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                </>
              )}
            />
          </View>

          {!existing && lastBudget ? (
            <SecondaryButton
              label={`Use last month’s ${formatMoney(lastBudget.limit, currency)}`}
              onPress={() => {
                haptics.selection();
                setValue('amount', amountToInput(lastBudget.limit), { shouldDirty: true });
              }}
            />
          ) : null}

          <View style={styles.status} accessibilityLabel={a11yLabel}>
            <BudgetProgress progress={status.progress} />
            <View style={styles.statusRows}>
              <View style={styles.statusRow}>
                <Text variant="body" color={colors.textSecondary}>
                  Spent
                </Text>
                <Text variant="amount">{formatMoney(spent, currency)}</Text>
              </View>
              <Divider />
              <View style={styles.statusRow}>
                <Text variant="body" color={colors.textSecondary}>
                  {status.overBudget ? 'Over budget' : 'Remaining'}
                </Text>
                <Text variant="amount">
                  {status.hasBudget
                    ? status.overBudget && status.overAmount !== null
                      ? formatMoney(status.overAmount, currency)
                      : formatMoney(status.remaining ?? 0, currency)
                    : '—'}
                </Text>
              </View>
              <Divider />
              <View style={styles.statusRow}>
                <Text variant="body" color={colors.textSecondary}>
                  Used
                </Text>
                <Text variant="amount">
                  {status.percentUsed !== null ? `${status.percentUsed}%` : '—'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <FormError message={saveError} />
            <PrimaryButton
              label={existing ? 'Save changes' : 'Save budget'}
              onPress={onSave}
              state={saveState}
            />
            {existing ? (
              <SecondaryButton label="Remove budget" onPress={() => setConfirming(true)} />
            ) : null}
          </View>

          {previous.length > 0 ? (
            <View style={styles.history}>
              <Text variant="sectionTitle" style={styles.historyTitle}>
                Previous budgets
              </Text>
              {previous.slice(0, 6).map((b) => (
                <View key={b.id}>
                  <View style={styles.historyRow}>
                    <Text variant="body">{monthLabel(monthKeyFromStored(b.month))}</Text>
                    <Text variant="amount">{formatMoney(b.limit, b.currency)}</Text>
                  </View>
                  <Divider />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={confirming}
        title={`Remove ${monthLabel(monthKey)} budget?`}
        message="Your transactions will not be affected."
        confirmLabel="Remove budget"
        onConfirm={onConfirmRemove}
        onClose={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  limitBlock: {
    gap: spacing.xs,
  },
  label: {
    textAlign: 'center',
  },
  status: {
    gap: spacing.md,
  },
  statusRows: {
    gap: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  history: {
    gap: spacing.xs,
  },
  historyTitle: {
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
});
