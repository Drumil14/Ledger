import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { spacing } from '@/constants/theme';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Row with a section title and an optional trailing text action. */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text variant="sectionTitle">{title}</Text>
      {actionLabel && onAction ? <TextLink label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
