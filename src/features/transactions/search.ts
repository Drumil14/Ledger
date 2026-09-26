import type { Transaction } from '@/types/transaction';

export const ALL_FILTER = 'All';

export type TransactionQuery = {
  search?: string;
  category?: string;
};

/** Client-side search over merchant, category and note. */
export function filterTransactions(
  transactions: Transaction[],
  { search, category }: TransactionQuery
): Transaction[] {
  const term = search?.trim().toLowerCase();

  return transactions.filter((t) => {
    if (category && category !== ALL_FILTER && t.category !== category) return false;
    if (term) {
      const haystack = `${t.merchant} ${t.category} ${t.note ?? ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export type DateGroup = { key: string; label: string; data: Transaction[] };

const monthDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupLabel(dayStart: number, now: Date): string {
  const today = startOfDay(now);
  const dayMs = 24 * 60 * 60 * 1000;
  if (dayStart === today) return 'TODAY';
  if (dayStart === today - dayMs) return 'YESTERDAY';
  return monthDayFormatter.format(new Date(dayStart)).toUpperCase();
}

/** Group transactions into date buckets, newest first. */
export function groupTransactionsByDate(
  transactions: Transaction[],
  now: Date = new Date()
): DateGroup[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const groups: DateGroup[] = [];
  const index = new Map<number, DateGroup>();

  for (const t of sorted) {
    const dayStart = startOfDay(new Date(t.date));
    let group = index.get(dayStart);
    if (!group) {
      group = { key: String(dayStart), label: groupLabel(dayStart, now), data: [] };
      index.set(dayStart, group);
      groups.push(group);
    }
    group.data.push(t);
  }

  return groups;
}

/** Flattened items for a single FlatList (header rows + transaction rows). */
export type ListItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'row'; key: string; transaction: Transaction };

export function toListItems(groups: DateGroup[]): ListItem[] {
  const items: ListItem[] = [];
  for (const group of groups) {
    items.push({ type: 'header', key: `h-${group.key}`, label: group.label });
    for (const t of group.data) {
      items.push({ type: 'row', key: t.id, transaction: t });
    }
  }
  return items;
}
