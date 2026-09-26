import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional monochrome icon (no illustrations). */
  icon?: React.ReactNode;
};

/** Intentional, typographic empty state. No cartoons. */
export function EmptyState({ title, description, actionLabel, onAction, icon }: Props) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text variant="sectionTitle" center>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color={colors.textSecondary} center style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  icon: {
    marginBottom: spacing.sm,
  },
  description: {
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xl,
  },
});
