import { StyleSheet, View } from 'react-native';

import { Divider } from '@/components/divider';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { spacing } from '@/constants/theme';

/** Structural placeholder for Home — keeps the layout stable while data loads. */
export function HomeSkeleton() {
  return (
    <Screen edges={['top']} style={styles.screen}>
      <Skeleton width={90} height={12} />
      <View style={styles.hero}>
        <Skeleton width={220} height={44} />
        <Skeleton width={130} height={14} />
      </View>
      <Skeleton width="100%" height={8} borderRadius={999} />
      <Skeleton width={200} height={14} />

      <Divider />

      <Skeleton width={110} height={22} />
      <Skeleton width="100%" height={132} borderRadius={12} />

      <Divider />

      <Skeleton width={80} height={22} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.row}>
          <View style={styles.rowLeft}>
            <Skeleton width={140} height={16} />
            <Skeleton width={80} height={12} />
          </View>
          <Skeleton width={64} height={16} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLeft: {
    gap: spacing.sm,
  },
});
