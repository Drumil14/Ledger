import { useState } from 'react';
import { useRouter } from 'expo-router';

import { ModalHeader } from '@/components/modal-header';
import { Screen } from '@/components/screen';
import type { ButtonState } from '@/components/primary-button';
import { toUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import { useCreateTransaction } from '@/features/transactions/queries';
import { formValuesToCreateInput, type TransactionFormValues } from '@/features/transactions/schema';

export default function AddExpense() {
  const { back } = useRouter();
  const { mutateAsync } = useCreateTransaction();
  const [state, setState] = useState<ButtonState>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (values: TransactionFormValues) => {
    setError(null);
    setState('loading');
    try {
      await mutateAsync(formValuesToCreateInput(values));
      setState('success');
      haptics.success();
      // Brief success beat, then dismiss back to where Add was opened from.
      setTimeout(back, 260);
    } catch (e) {
      setState('idle');
      setError(toUserMessage(e));
      haptics.error();
    }
  };

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Add expense" onClose={back} />
      <TransactionForm
        submitLabel="Add expense"
        submitState={state}
        errorMessage={error}
        onSubmit={onSubmit}
        autoFocusAmount
      />
    </Screen>
  );
}
