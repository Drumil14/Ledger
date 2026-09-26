import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ModalHeader } from '@/components/modal-header';
import { PrimaryButton, type ButtonState } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { compressReceiptImage, type PreparedImage } from '@/lib/receipt-image';
import { useDemo } from '@/features/demo/demo-context';
import { DEMO_RECEIPT_PROCESSING_MS, sampleReceiptExtraction } from '@/features/demo/demo-receipt';
import { ProcessingView } from '@/features/receipts/components/processing-view';
import {
  receiptLineItems,
  receiptToFormValues,
  uncertaintyMessage,
  uncertainFields,
  type ReceiptExtraction,
} from '@/features/receipts/schema';
import { extractReceipt, uploadReceiptImage, ReceiptError, type ReceiptErrorCode } from '@/services/receipts';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import { useCreateTransaction } from '@/features/transactions/queries';
import { formValuesToCreateInput, type TransactionFormValues } from '@/features/transactions/schema';

type Status = 'processing' | 'confirm' | 'error';

const ERROR_COPY: Record<ReceiptErrorCode, { title: string; description: string }> = {
  offline: {
    title: 'You’re offline',
    description: 'Receipt scanning needs an internet connection right now.',
  },
  rate_limited: {
    title: 'Daily scan limit reached',
    description: 'You’ve hit today’s scan limit. You can still enter it manually.',
  },
  unauthorized: {
    title: 'Session expired',
    description: 'Please log in again to scan receipts.',
  },
  failed: {
    title: 'Couldn’t read this receipt',
    description: 'Try taking a clearer photo, or enter the expense manually.',
  },
};

export default function ReceiptScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string; source?: string; demo?: string }>();
  const { isDemoMode } = useDemo();
  const { mutateAsync: createTransaction } = useCreateTransaction();

  const [status, setStatus] = useState<Status>('processing');
  const [errorCode, setErrorCode] = useState<ReceiptErrorCode>('failed');
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [formValues, setFormValues] = useState<TransactionFormValues | null>(null);

  const [saveState, setSaveState] = useState<ButtonState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Async by construction — the first statement awaits, so no state is set
  // synchronously inside the mount effect.
  const runExtraction = useCallback(async () => {
    try {
      // Demo mode never touches the network / Anthropic. It optionally prepares a
      // local thumbnail (if an image was chosen) then returns the bundled sample
      // through the exact same review UI a real scan uses.
      if (isDemoMode) {
        if (uri && !prepared) {
          try {
            setPrepared(await compressReceiptImage(uri));
          } catch {
            // Thumbnail is best-effort in demo — never block the flow.
          }
        }
        await new Promise((resolve) => setTimeout(resolve, DEMO_RECEIPT_PROCESSING_MS));
        const result = sampleReceiptExtraction();
        setExtraction(result);
        setFormValues(receiptToFormValues(result));
        haptics.light();
        setStatus('confirm');
        return;
      }

      const image = prepared ?? (await compressReceiptImage(uri as string));
      if (!prepared) setPrepared(image);
      const result = await extractReceipt({ base64: image.base64, mediaType: image.mediaType });
      setExtraction(result);
      setFormValues(receiptToFormValues(result));
      haptics.light();
      setStatus('confirm');
    } catch (e) {
      setErrorCode(e instanceof ReceiptError ? e.code : 'failed');
      setStatus('error');
    }
  }, [isDemoMode, prepared, uri]);

  const retry = useCallback(() => {
    setStatus('processing');
    void runExtraction();
  }, [runExtraction]);

  useEffect(() => {
    // Kick off extraction once on mount (async — state is set only after awaits).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runExtraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async (values: TransactionFormValues) => {
    setSaveError(null);
    setSaveState('loading');
    try {
      let receiptPath: string | undefined;
      // Never upload to Supabase in demo mode.
      if (!isDemoMode && prepared) {
        try {
          receiptPath = await uploadReceiptImage(prepared.base64);
        } catch {
          // Best effort — never block saving the expense on the image upload.
          receiptPath = undefined;
        }
      }
      await createTransaction({
        ...formValuesToCreateInput(values),
        sourceType: 'receipt',
        receiptPath,
        receiptItems: extraction ? receiptLineItems(extraction) : undefined,
      });
      setSaveState('success');
      haptics.success();
      setTimeout(() => router.back(), 260);
    } catch (e) {
      setSaveState('idle');
      setSaveError(toUserMessage(e));
      haptics.error();
    }
  };

  if (status === 'processing') {
    return (
      <Screen edges={['top']}>
        <ModalHeader title="Scanning" onClose={() => router.back()} />
        <ProcessingView imageUri={prepared?.uri} />
      </Screen>
    );
  }

  if (status === 'error') {
    const copy = ERROR_COPY[errorCode];
    return (
      <Screen edges={['top']}>
        <ModalHeader title="Receipt" onClose={() => router.back()} />
        <View style={styles.errorBody}>
          <Text variant="sectionTitle" center>
            {copy.title}
          </Text>
          <Text variant="body" color={colors.textSecondary} center style={styles.errorCopy}>
            {copy.description}
          </Text>
        </View>
        <View style={styles.errorActions}>
          {errorCode === 'rate_limited' ? null : (
            <PrimaryButton label="Try again" onPress={retry} />
          )}
          <SecondaryButton label="Enter manually" onPress={() => router.replace('/add-expense')} />
        </View>
      </Screen>
    );
  }

  // status === 'confirm'
  const hintFields = extraction ? uncertainFields(extraction) : [];
  const hint = uncertaintyMessage(hintFields);

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Check receipt" onClose={() => router.back()} />
      {formValues ? (
        <TransactionForm
          initialValues={formValues}
          submitLabel="Save expense"
          submitState={saveState}
          errorMessage={saveError}
          onSubmit={onSave}
          header={
            <View style={styles.confirmHeader}>
              {prepared?.uri ? (
                <Image
                  source={{ uri: prepared.uri }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  accessibilityLabel="Scanned receipt"
                />
              ) : null}
              <Text variant="body" color={colors.textSecondary} center style={styles.subheading}>
                Ledger found these details. Make sure everything looks right.
              </Text>
              {hint ? (
                <Text variant="metadata" color={colors.primary} center>
                  {hint}
                </Text>
              ) : null}
            </View>
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  errorCopy: {
    maxWidth: 300,
  },
  errorActions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  confirmHeader: {
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbnail: {
    width: 92,
    height: 116,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceAlt,
  },
  subheading: {
    maxWidth: 300,
  },
});
