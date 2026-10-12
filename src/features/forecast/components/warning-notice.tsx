import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { warningCopy } from '@/features/forecast/view-model';
import type { ForecastWarning } from '@/features/forecast/types';

type Props = {
  warnings: ForecastWarning[];
};

/**
 * Renders forecast warnings as calm, inset notices. Monochrome — a left ink rule
 * signals "pay attention" without colour. Never hidden to tidy the UI.
 */
export function WarningNotice({ warnings }: Props) {
  if (warnings.length === 0) return null;
  return (
    <View style={styles.list}>
      {warnings.map((w) => {
        const copy = warningCopy(w);
        return (
          <View key={w} style={styles.notice} accessibilityRole="text" accessibilityLabel={`${copy.title}. ${copy.body}`}>
            <Text variant="rowTitle" style={styles.title}>
              {copy.title}
            </Text>
            <Text variant="metadata" color={colors.textSecondary}>
              {copy.body}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  notice: {
    gap: 2,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    borderCurve: 'continuous',
  },
  title: {
    fontSize: 15,
  },
});
