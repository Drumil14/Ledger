import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { FieldButton } from '@/components/field-button';
import { Text } from '@/components/text';
import { CATEGORIES, type Category } from '@/constants/categories';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type Props = {
  value: Category;
  onChange: (category: Category) => void;
  error?: string;
};

/** Category field + monochrome selection sheet (checkmark, haptic on select). */
export function CategoryPicker({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);

  const select = (category: Category) => {
    haptics.selection();
    onChange(category);
    setOpen(false);
  };

  return (
    <>
      <FieldButton
        label="Category"
        value={value}
        onPress={() => setOpen(true)}
        error={error}
        right={<ChevronDown size={18} color={colors.textSecondary} strokeWidth={1.8} />}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Category">
        <View>
          {CATEGORIES.map((category, index) => {
            const selected = category === value;
            return (
              <View key={category}>
                <Pressable
                  onPress={() => select(category)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={category}
                >
                  <Text variant="rowTitle" color={selected ? colors.primary : colors.textSecondary}>
                    {category}
                  </Text>
                  {selected ? <Check size={20} color={colors.primary} strokeWidth={2} /> : null}
                </Pressable>
                {index < CATEGORIES.length - 1 ? <Divider /> : null}
              </View>
            );
          })}
        </View>
      </BottomSheet>
    </>
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
