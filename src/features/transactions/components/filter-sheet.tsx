import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { Text } from '@/components/text';
import { CATEGORIES } from '@/constants/categories';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { ALL_FILTER } from '@/features/transactions/search';

type Props = {
  visible: boolean;
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

const OPTIONS = [ALL_FILTER, ...CATEGORIES];

/** Compact monochrome category filter. */
export function FilterSheet({ visible, value, onSelect, onClose }: Props) {
  const select = (option: string) => {
    haptics.selection();
    onSelect(option);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filter by category">
      <View>
        {OPTIONS.map((option, index) => {
          const selected = option === value;
          return (
            <View key={option}>
              <Pressable
                onPress={() => select(option)}
                style={styles.row}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={option}
              >
                <Text variant="rowTitle" color={selected ? colors.primary : colors.textSecondary}>
                  {option}
                </Text>
                {selected ? <Check size={20} color={colors.primary} strokeWidth={2} /> : null}
              </Pressable>
              {index < OPTIONS.length - 1 ? <Divider /> : null}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
});
