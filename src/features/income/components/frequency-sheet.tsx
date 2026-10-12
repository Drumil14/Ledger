import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import {
  INCOME_FREQUENCIES,
  incomeFrequencyLabel,
  type IncomeFormFrequency,
} from '@/features/income/schema';

type Props = {
  visible: boolean;
  value: IncomeFormFrequency;
  onSelect: (frequency: IncomeFormFrequency) => void;
  onClose: () => void;
};

/** Bottom-sheet picker for the income payment frequency. */
export function FrequencySheet({ visible, value, onSelect, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Frequency">
      <View>
        {INCOME_FREQUENCIES.map((frequency, index) => {
          const active = frequency === value;
          return (
            <View key={frequency}>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  onSelect(frequency);
                  onClose();
                }}
                style={styles.row}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={incomeFrequencyLabel(frequency)}
              >
                <Text variant="body" color={active ? colors.primary : colors.textSecondary}>
                  {incomeFrequencyLabel(frequency)}
                </Text>
                {active ? <Check size={20} color={colors.primary} strokeWidth={2} /> : null}
              </Pressable>
              {index < INCOME_FREQUENCIES.length - 1 ? <Divider /> : null}
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
    paddingVertical: spacing.lg,
  },
});
