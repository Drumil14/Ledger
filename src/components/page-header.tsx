import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Optional trailing element (e.g. an action). */
  right?: React.ReactNode;
};

/** Large page title used at the top of primary screens. */
export function PageHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text variant="pageTitle" style={styles.title}>
          {title}
        </Text>
        {right ? <View>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text variant="body" color={colors.textSecondary}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
});
