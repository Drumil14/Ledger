import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, hairline, spacing } from '@/constants/theme';

type Props = {
  /** Optional centered label, e.g. "or". */
  label?: string;
};

/** Hairline divider, optionally with a centered label. */
export function Divider({ label }: Props) {
  if (!label) {
    return <View style={styles.line} />;
  }
  return (
    <View style={styles.labelledRow}>
      <View style={styles.flexLine} />
      <Text variant="metadata" color={colors.textSecondary} style={styles.label}>
        {label}
      </Text>
      <View style={styles.flexLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    height: hairline,
    backgroundColor: colors.divider,
  },
  flexLine: {
    flex: 1,
    height: hairline,
    backgroundColor: colors.divider,
  },
  labelledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    textTransform: 'lowercase',
  },
});
