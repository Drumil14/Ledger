import { StyleSheet, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

/** Compact, unobtrusive search input (no giant card). */
export function SearchField({ value, onChangeText }: Props) {
  return (
    <View style={styles.container}>
      <Search size={18} color={colors.textSecondary} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search your transactions"
        placeholderTextColor={colors.disabled}
        style={styles.input}
        selectionColor={colors.primary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search transactions"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.primary,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    padding: 0,
  },
});
