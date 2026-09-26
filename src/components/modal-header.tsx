import { Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type Props = {
  title: string;
  onClose: () => void;
};

/** Header for modal screens: title + a close control. */
export function ModalHeader({ title, onClose }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="sectionTitle">{title}</Text>
      <Pressable
        onPress={() => {
          haptics.selection();
          onClose();
        }}
        hitSlop={12}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <X size={24} color={colors.primary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
