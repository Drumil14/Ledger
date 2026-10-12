import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { FORECAST_HORIZONS, type ForecastHorizonId } from '@/features/forecast/view-model';

type Props = {
  value: ForecastHorizonId;
  onChange: (id: ForecastHorizonId) => void;
};

/** Monochrome segmented control for the forecast horizon. */
export function HorizonToggle({ value, onChange }: Props) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {FORECAST_HORIZONS.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(option.id);
            }}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text variant="button" color={active ? colors.onPrimary : colors.textSecondary}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
});
