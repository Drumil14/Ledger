import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { FormField } from '@/components/form-field';
import { PrimaryButton, type ButtonState } from '@/components/primary-button';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { FormError } from '@/features/auth/components/form-error';
import { AmountInput } from '@/features/transactions/components/amount-input';
import { CategoryPicker } from '@/features/transactions/components/category-picker';
import { DateField } from '@/features/transactions/components/date-field';
import {
  emptyTransactionForm,
  transactionFormSchema,
  type TransactionFormValues,
} from '@/features/transactions/schema';

type Props = {
  initialValues?: TransactionFormValues;
  submitLabel: string;
  submitState: ButtonState;
  errorMessage?: string | null;
  onSubmit: (values: TransactionFormValues) => void;
  onDelete?: () => void;
  autoFocusAmount?: boolean;
  /** Optional content rendered above the amount (e.g. a receipt thumbnail/hint). */
  header?: React.ReactNode;
};

/** The one create/edit form. `mode` is expressed via props, never duplicated. */
export function TransactionForm({
  initialValues,
  submitLabel,
  submitState,
  errorMessage,
  onSubmit,
  onDelete,
  autoFocusAmount,
  header,
}: Props) {
  const { control, handleSubmit } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: initialValues ?? emptyTransactionForm(),
    mode: 'onTouched',
  });

  const submit = handleSubmit(
    (values) => onSubmit(values),
    () => haptics.warning()
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {header ? <View style={styles.header}>{header}</View> : null}

        <Controller
          control={control}
          name="amount"
          render={({ field: { value, onChange } }) => (
            <AmountInput value={value} onChangeText={onChange} autoFocus={autoFocusAmount} />
          )}
        />

        <View style={styles.fields}>
          <Controller
            control={control}
            name="merchant"
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <FormField
                label="Merchant"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={fieldState.error?.message}
                placeholder="Trader Joe's"
                autoCapitalize="words"
                returnKeyType="done"
              />
            )}
          />

          <Controller
            control={control}
            name="category"
            render={({ field: { value, onChange }, fieldState }) => (
              <CategoryPicker value={value} onChange={onChange} error={fieldState.error?.message} />
            )}
          />

          <Controller
            control={control}
            name="date"
            render={({ field: { value, onChange }, fieldState }) => (
              <DateField value={value} onChange={onChange} error={fieldState.error?.message} />
            )}
          />

          <Controller
            control={control}
            name="note"
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <FormField
                label="Note"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={fieldState.error?.message}
                placeholder="Optional"
              />
            )}
          />
        </View>

        <View style={styles.submit}>
          <FormError message={errorMessage ?? null} />
          <PrimaryButton label={submitLabel} onPress={submit} state={submitState} />
        </View>

        {onDelete ? (
          <Pressable
            onPress={onDelete}
            style={styles.delete}
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
          >
            <Text variant="button" color={colors.primary}>
              Delete expense
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  header: {
    marginBottom: spacing.lg,
  },
  fields: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  submit: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  delete: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
});
