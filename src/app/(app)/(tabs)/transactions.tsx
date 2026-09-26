import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { toUserMessage } from '@/lib/errors';
import { FilterSheet } from '@/features/transactions/components/filter-sheet';
import { SearchField } from '@/features/transactions/components/search-field';
import { SwipeableTransactionRow } from '@/features/transactions/components/swipeable-transaction-row';
import { useDeleteTransaction, useTransactionsQuery } from '@/features/transactions/queries';
import {
  ALL_FILTER,
  filterTransactions,
  groupTransactionsByDate,
  toListItems,
  type ListItem,
} from '@/features/transactions/search';

const timeFormatter = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

export default function Transactions() {
  const { push } = useRouter();
  const { data, isLoading, isError, refetch } = useTransactionsQuery();
  const { mutate: remove } = useDeleteTransaction();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const items = useMemo(() => {
    const filtered = filterTransactions(data ?? [], { search, category });
    return toListItems(groupTransactionsByDate(filtered));
  }, [data, search, category]);

  const hasAny = (data?.length ?? 0) > 0;
  const filterActive = category !== ALL_FILTER;

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <Text variant="metadata" color={colors.textSecondary} style={styles.groupLabel}>
          {item.label}
        </Text>
      );
    }
    const t = item.transaction;
    return (
      <SwipeableTransactionRow
        transaction={t}
        timeLabel={timeFormatter.format(new Date(t.date))}
        onPress={() => push(`/transaction/${t.id}`)}
        onDelete={() => setPendingDeleteId(t.id)}
      />
    );
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <PageHeader title="Transactions" />
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <SearchField value={search} onChangeText={setSearch} />
          </View>
          <Pressable
            onPress={() => setFilterOpen(true)}
            style={styles.filterButton}
            accessibilityRole="button"
            accessibilityLabel={filterActive ? `Filter: ${category}` : 'Filter'}
          >
            <SlidersHorizontal
              size={20}
              color={filterActive ? colors.primary : colors.textSecondary}
              strokeWidth={1.9}
            />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <View style={styles.skeletonLeft}>
                <Skeleton width={150} height={16} />
                <Skeleton width={90} height={12} />
              </View>
              <Skeleton width={64} height={16} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          title="Couldn’t load transactions"
          description={toUserMessage(new Error('network'))}
          actionLabel="Try again"
          onAction={() => refetch()}
        />
      ) : !hasAny ? (
        <EmptyState
          title="No transactions yet"
          description="Add your first expense and it will show up here."
          actionLabel="Add expense"
          onAction={() => push('/add-expense')}
        />
      ) : items.length === 0 ? (
        <View style={styles.noResults}>
          <Text variant="body" color={colors.textSecondary} center>
            No transactions match your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FilterSheet
        visible={filterOpen}
        value={category}
        onSelect={setCategory}
        onClose={() => setFilterOpen(false)}
      />
      <ConfirmSheet
        visible={pendingDeleteId !== null}
        title="Delete expense?"
        message="This can’t be undone."
        confirmLabel="Delete expense"
        onConfirm={() => {
          if (pendingDeleteId) remove(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onClose={() => setPendingDeleteId(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  groupLabel: {
    letterSpacing: 1.2,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  loading: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  skeletonLeft: {
    gap: spacing.sm,
  },
  noResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
});
