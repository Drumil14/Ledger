import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { Divider } from '@/components/divider';
import { formatMoney } from '@/components/money-text';
import { ModalHeader } from '@/components/modal-header';
import { PrimaryButton, type ButtonState } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { colors, radius, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { centsToAmount } from '@/lib/money';
import { AmountInput } from '@/features/transactions/components/amount-input';
import { DateField } from '@/features/transactions/components/date-field';
import { useBalancesQuery, useDeleteBalance, useUpsertBalance } from '@/features/balances/queries';
import { balanceFormSchema, balanceFormToInput, emptyBalanceForm, type BalanceFormValues } from '@/features/balances/schema';
import { balanceStaleness } from '@/features/forecast/view-model';
import type { BalanceSnapshot } from '@/types/income';

const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function BalanceScreen() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);

  const balances = useBalancesQuery();
  const upsertBalance = useUpsertBalance();
  const deleteBalance = useDeleteBalance();

  const latest = balances.data?.[0] ?? null;
  const staleness = latest ? balanceStaleness(latest.effectiveDate, now) : null;

  const { control, handleSubmit } = useForm<BalanceFormValues>({
    resolver: zodResolver(balanceFormSchema),
    defaultValues: emptyBalanceForm(now),
    mode: 'onTouched',
  });

  const [saveState, setSaveState] = useState<ButtonState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BalanceSnapshot | null>(null);

  const onSave = handleSubmit(
    async (values) => {
      setSaveError(null);
      setSaveState('loading');
      try {
        await upsertBalance.mutateAsync(balanceFormToInput(values));
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
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    haptics.warning();
    deleteBalance.mutate(id);
  };

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Balance" onClose={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Current declared balance (reference) */}
          {latest ? (
            <View style={styles.current}>
              <Text variant="metadata" color={colors.textSecondary}>
                CURRENT DECLARED BALANCE
              </Text>
              <Text variant="display" style={styles.tabular}>
                {formatMoney(centsToAmount(latest.amountCents), latest.currency)}
              </Text>
              <Text variant="metadata" color={colors.textSecondary}>
                Manually entered · as of {longDate.format(parseKey(latest.effectiveDate))}
              </Text>
              {staleness?.isStale ? (
                <View style={styles.staleNotice}>
                  <Text variant="metadata" color={colors.textSecondary}>
                    This balance is {staleness.daysOld} days old. Update it for an accurate projection —
                    Ledger won’t treat an old snapshot as today’s balance.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.current}>
              <Text variant="sectionTitle">No balance yet</Text>
              <Text variant="body" color={colors.textSecondary}>
                Enter your current account balance so Ledger can project your ending balance. Without it,
                the forecast shows relative cash flow only.
              </Text>
            </View>
          )}

          <Divider />

          {/* Entry */}
          <View style={styles.amountBlock}>
            <Text variant="metadata" color={colors.textSecondary} center>
              New balance
            </Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange }, fieldState }) => (
                <>
                  <AmountInput value={value} onChangeText={onChange} autoFocus={!latest} />
                  {fieldState.error ? (
                    <Text variant="metadata" color={colors.primary} center>
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                </>
              )}
            />
          </View>

          <View style={styles.fields}>
            <Controller
              control={control}
              name="negative"
              render={({ field: { value, onChange } }) => (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text variant="body">Negative balance</Text>
                    <Text variant="metadata" color={colors.textSecondary}>
                      Turn on if this account is overdrawn.
                    </Text>
                  </View>
                  <Toggle
                    value={value}
                    onValueChange={(next) => {
                      haptics.selection();
                      onChange(next);
                    }}
                    accessibilityLabel="Negative balance"
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="date"
              render={({ field: { value, onChange }, fieldState }) => (
                <DateField
                  label="As of"
                  value={value}
                  onChange={onChange}
                  error={fieldState.error?.message}
                  maximumDate={now}
                />
              )}
            />
          </View>

          <View style={styles.actions}>
            {saveError ? (
              <Text variant="metadata" color={colors.primary} center>
                {saveError}
              </Text>
            ) : null}
            <PrimaryButton label="Save balance" onPress={onSave} state={saveState} />
          </View>

          {/* History */}
          {balances.data && balances.data.length > 0 ? (
            <View style={styles.history}>
              <Text variant="sectionTitle" style={styles.historyTitle}>
                History
              </Text>
              {balances.data.slice(0, 8).map((snapshot) => (
                <View key={snapshot.id}>
                  <View style={styles.historyRow}>
                    <Text variant="body" color={colors.textSecondary}>
                      {shortDate.format(parseKey(snapshot.effectiveDate))}
                    </Text>
                    <View style={styles.historyRight}>
                      <Text variant="amount" style={styles.tabular}>
                        {formatMoney(centsToAmount(snapshot.amountCents), snapshot.currency)}
                      </Text>
                      <SecondaryButtonCompact onPress={() => setRemoving(snapshot)} />
                    </View>
                  </View>
                  <Divider />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={removing !== null}
        title="Remove this balance?"
        message="Ledger will fall back to your next most recent balance, or to a relative forecast."
        confirmLabel="Remove"
        onConfirm={onConfirmRemove}
        onClose={() => setRemoving(null)}
      />
    </Screen>
  );
}

/** Small inline "Remove" text control for a history row. */
function SecondaryButtonCompact({ onPress }: { onPress: () => void }) {
  return (
    <Text
      variant="metadata"
      color={colors.textSecondary}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Remove balance"
      style={styles.remove}
    >
      Remove
    </Text>
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
  current: {
    gap: spacing.xs,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  staleNotice: {
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    borderCurve: 'continuous',
  },
  amountBlock: {
    gap: spacing.xs,
  },
  fields: {
    gap: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  toggleText: {
    flex: 1,
    gap: 2,
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
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  remove: {
    paddingVertical: spacing.xs,
  },
});
