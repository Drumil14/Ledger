import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Divider } from '@/components/divider';
import { EmptyState } from '@/components/empty-state';
import { formatMoney } from '@/components/money-text';
import { ModalHeader } from '@/components/modal-header';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { colors, spacing } from '@/constants/theme';
import { centsToAmount } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { useIncomeQuery, useUpdateIncome } from '@/features/income/queries';
import type { IncomeSource } from '@/types/income';

function describeSchedule(record: IncomeSource): string {
  const money = formatMoney(centsToAmount(record.amountCents), record.currency);
  switch (record.schedule.kind) {
    case 'weekly':
      return `Weekly · ${money}`;
    case 'biweekly':
      return `Every 2 weeks · ${money}`;
    case 'monthly':
      return `Monthly · ${money}`;
    case 'one-time':
      return `One-time · ${money}`;
    case 'custom':
      return `Custom · ${money}`;
  }
}

export default function IncomeScreen() {
  const { back, push } = useRouter();
  const { data, isLoading, isError, refetch } = useIncomeQuery();
  const updateIncome = useUpdateIncome();

  const onToggle = (record: IncomeSource, next: boolean) => {
    haptics.selection();
    updateIncome.mutate({ id: record.id, active: next });
  };

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Income" onClose={back} />

      {isLoading ? (
        <Centered>
          <Text variant="body" color={colors.textSecondary}>
            Loading…
          </Text>
        </Centered>
      ) : isError || !data ? (
        <EmptyState
          title="Couldn’t load income"
          description="Your data is safe. Try again in a moment."
          actionLabel="Try again"
          onAction={refetch}
        />
      ) : data.length === 0 ? (
        <EmptyState
          title="No income yet."
          description="Add your paychecks and other income so Ledger can forecast your cash flow."
          actionLabel="Add income"
          onAction={() => push('/income-edit')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text variant="metadata" color={colors.textSecondary}>
            Income you add here powers your cash-flow forecast. Deactivate a source to exclude it
            without deleting it.
          </Text>

          <View style={styles.list}>
            {data.map((record, index) => (
              <View key={record.id}>
                <View style={styles.row}>
                  <Pressable
                    style={styles.rowLeft}
                    onPress={() => {
                      haptics.light();
                      push(`/income-edit?id=${record.id}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${record.name}`}
                  >
                    <Text variant="rowTitle" numberOfLines={1} color={record.active ? colors.primary : colors.disabled}>
                      {record.name}
                    </Text>
                    <Text variant="metadata" color={colors.textSecondary}>
                      {describeSchedule(record)}
                      {record.active ? '' : ' · Inactive'}
                    </Text>
                  </Pressable>
                  <Toggle
                    value={record.active}
                    onValueChange={(next) => onToggle(record, next)}
                    accessibilityLabel={`${record.name} active`}
                  />
                </View>
                {index < data.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </View>

          <PrimaryButton label="Add income" onPress={() => push('/income-edit')} />
        </ScrollView>
      )}
    </Screen>
  );
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
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
