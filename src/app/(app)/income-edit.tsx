import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { FieldButton } from '@/components/field-button';
import { FormField } from '@/components/form-field';
import { ModalHeader } from '@/components/modal-header';
import { PrimaryButton, type ButtonState } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { colors, radius, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { FormError } from '@/features/auth/components/form-error';
import { AmountInput } from '@/features/transactions/components/amount-input';
import { DateField } from '@/features/transactions/components/date-field';
import { FrequencySheet } from '@/features/income/components/frequency-sheet';
import { useCreateIncome, useDeleteIncome, useIncomeQuery, useUpdateIncome } from '@/features/income/queries';
import {
  describeFixedSchedule,
  emptyIncomeForm,
  incomeDateLabel,
  incomeFormSchema,
  incomeFormToCreateInput,
  incomeFormToUpdateInput,
  incomeFrequencyLabel,
  incomeToFormValues,
  isEditableSchedule,
  type IncomeFormValues,
} from '@/features/income/schema';

export default function IncomeEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const now = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => new Date(now.getFullYear() + 3, now.getMonth(), now.getDate()), [now]);

  const income = useIncomeQuery();
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();
  const deleteIncome = useDeleteIncome();

  const existing = id ? (income.data ?? []).find((r) => r.id === id) : undefined;
  const isEdit = !!existing;
  // Custom (arbitrary-date) schedules can't be represented by this form, so they
  // stay read-only — editing name/amount/status must never rewrite the dates.
  const schedulable = !existing || isEditableSchedule(existing);

  const initial = useMemo<IncomeFormValues>(
    () => (existing ? incomeToFormValues(existing) : emptyIncomeForm(now)),
    [existing, now]
  );

  const { control, handleSubmit } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: initial,
    values: existing ? incomeToFormValues(existing) : undefined,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  });

  const frequency = useWatch({ control, name: 'frequency' }) ?? initial.frequency;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveState, setSaveState] = useState<ButtonState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const onSave = handleSubmit(
    async (values) => {
      setSaveError(null);
      setSaveState('loading');
      try {
        if (existing) await updateIncome.mutateAsync(incomeFormToUpdateInput(values, existing));
        else await createIncome.mutateAsync(incomeFormToCreateInput(values));
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

  const onConfirmDelete = () => {
    if (!existing) return;
    setConfirming(false);
    haptics.warning();
    deleteIncome.mutate(existing.id);
    router.back();
  };

  return (
    <Screen edges={['top']}>
      <ModalHeader title={isEdit ? 'Edit income' : 'Add income'} onClose={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.amountBlock}>
            <Text variant="metadata" color={colors.textSecondary} center>
              Amount per payment
            </Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { value, onChange }, fieldState }) => (
                <>
                  <AmountInput value={value} onChangeText={onChange} autoFocus={!isEdit} />
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
              name="name"
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <FormField
                  label="Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={fieldState.error?.message}
                  placeholder="Paycheck"
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              )}
            />

            {schedulable ? (
              <>
                <Controller
                  control={control}
                  name="frequency"
                  render={({ field: { value } }) => (
                    <FieldButton
                      label="Frequency"
                      value={incomeFrequencyLabel(value)}
                      onPress={() => {
                        haptics.selection();
                        setSheetOpen(true);
                      }}
                      right={<ChevronDown size={18} color={colors.textSecondary} strokeWidth={1.8} />}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="date"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <DateField
                      label={incomeDateLabel(frequency)}
                      value={value}
                      onChange={onChange}
                      error={fieldState.error?.message}
                      maximumDate={maxDate}
                    />
                  )}
                />
              </>
            ) : existing ? (
              <View style={styles.readonly}>
                <Text variant="metadata" color={colors.textSecondary} style={styles.readonlyLabel}>
                  Schedule
                </Text>
                <View style={styles.readonlyField}>
                  <Text variant="body">{describeFixedSchedule(existing)}</Text>
                </View>
                <Text variant="metadata" color={colors.textSecondary}>
                  Custom schedules can’t be edited here yet — name, amount and status still update, and
                  the dates are kept exactly as they are.
                </Text>
              </View>
            ) : null}

            {isEdit ? (
              <Controller
                control={control}
                name="active"
                render={({ field: { value, onChange } }) => (
                  <View style={styles.activeRow}>
                    <View style={styles.activeText}>
                      <Text variant="body">Active</Text>
                      <Text variant="metadata" color={colors.textSecondary}>
                        Inactive income is excluded from the forecast.
                      </Text>
                    </View>
                    <Toggle
                      value={value}
                      onValueChange={(next) => {
                        haptics.selection();
                        onChange(next);
                      }}
                      accessibilityLabel="Active"
                    />
                  </View>
                )}
              />
            ) : null}
          </View>

          <View style={styles.actions}>
            <FormError message={saveError} />
            <PrimaryButton label={isEdit ? 'Save changes' : 'Add income'} onPress={onSave} state={saveState} />
            {isEdit ? <SecondaryButton label="Delete income" onPress={() => setConfirming(true)} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {schedulable ? (
        <Controller
          control={control}
          name="frequency"
          render={({ field: { value, onChange } }) => (
            <FrequencySheet
              visible={sheetOpen}
              value={value}
              onSelect={onChange}
              onClose={() => setSheetOpen(false)}
            />
          )}
        />
      ) : null}

      <ConfirmSheet
        visible={confirming}
        title={`Delete ${existing?.name ?? 'income'}?`}
        message="This removes it from your forecast. Your transactions are not affected."
        confirmLabel="Delete income"
        onConfirm={onConfirmDelete}
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
  amountBlock: {
    gap: spacing.xs,
  },
  fields: {
    gap: spacing.lg,
  },
  readonly: {
    gap: spacing.xs,
  },
  readonlyLabel: {
    marginLeft: spacing.xs,
  },
  readonlyField: {
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  activeText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: spacing.md,
  },
});
