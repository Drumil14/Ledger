import { StyleSheet, View } from 'react-native';

import { Divider } from '@/components/divider';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { spacing } from '@/constants/theme';

/** Structural placeholder for Insights — mirrors the real layout so it settles
 * without a jump, consistent with Home's skeleton. */
export function InsightsSkeleton() {
  return (
    <Screen edges={['top']} style={styles.screen}>
      <Skeleton width={120} height={30} />

      <View style={styles.monthRow}>
        <Skeleton width={180} height={20} />
      </View>

      <View style={styles.hero}>
        <Skeleton width={200} height={44} />
        <Skeleton width={130} height={14} />
      </View>

      <Divider />

      <Skeleton width={120} height={22} />
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.barRow}>
          <View style={styles.barTop}>
            <Skeleton width={110} height={16} />
            <Skeleton width={56} height={16} />
          </View>
          <Skeleton width="100%" height={6} borderRadius={999} />
        </View>
      ))}

      <Divider />

      <Skeleton width={140} height={22} />
      <Skeleton width="100%" height={140} borderRadius={12} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  monthRow: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  hero: {
    gap: spacing.sm,
  },
  barRow: {
    gap: spacing.sm,
  },
  barTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
