import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { ModalHeader } from '@/components/modal-header';
import type { ButtonState } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { colors, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import {
  useCachedTransaction,
  useDeleteTransaction,
  useTransactionsQuery,
  useUpdateTransaction,
} from '@/features/transactions/queries';
import {
  formValuesToUpdateInput,
  transactionToFormValues,
  type TransactionFormValues,
} from '@/features/transactions/schema';

export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { back, push } = useRouter();
  const { isLoading } = useTransactionsQuery();
  const transaction = useCachedTransaction(id);

  const { mutateAsync: update } = useUpdateTransaction();
  const { mutate: remove } = useDeleteTransaction();

  const [state, setState] = useState<ButtonState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const onSubmit = async (values: TransactionFormValues) => {
    if (!id) return;
    setError(null);
    setState('loading');
    try {
      await update(formValuesToUpdateInput(id, values));
      setState('success');
      haptics.success();
      setTimeout(back, 260);
    } catch (e) {
      setState('idle');
      setError(toUserMessage(e));
      haptics.error();
    }
  };

  const onConfirmDelete = () => {
    if (!id) return;
    setConfirming(false);
    haptics.warning();
    remove(id);
    back();
  };

  if (!transaction) {
    return (
      <Screen edges={['top']}>
        <ModalHeader title="Expense" onClose={back} />
        <View style={styles.missing}>
          <Text variant="body" color={colors.textSecondary} center>
            {isLoading ? 'Loading…' : 'This expense is no longer available.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Edit expense" onClose={back} />
      <TransactionForm
        initialValues={transactionToFormValues(transaction)}
        submitLabel="Save changes"
        submitState={state}
        errorMessage={error}
        onSubmit={onSubmit}
        onDelete={() => setConfirming(true)}
        header={
          transaction.sourceType === 'receipt' && transaction.receiptPath ? (
            <View style={styles.receiptRow}>
              <Text variant="metadata" color={colors.textSecondary}>
                Receipt
              </Text>
              <TextLink
                label="View original"
                onPress={() =>
                  push({ pathname: '/receipt-view', params: { path: transaction.receiptPath ?? '' } })
                }
              />
            </View>
          ) : undefined
        }
      />
      <ConfirmSheet
        visible={confirming}
        title="Delete expense?"
        message="This can’t be undone."
        confirmLabel="Delete expense"
        onConfirm={onConfirmDelete}
        onClose={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
