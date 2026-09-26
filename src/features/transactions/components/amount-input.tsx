import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, fontFamily } from '@/constants/theme';
import { sanitizeAmountInput } from '@/lib/money';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
};

/** The hero amount field — large, centred, numeric, sanitised on every keystroke. */
export function AmountInput({ value, onChangeText, autoFocus }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.symbol} allowFontScaling={false}>
        $
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(sanitizeAmountInput(text))}
        placeholder="0.00"
        placeholderTextColor={colors.disabled}
        keyboardType="decimal-pad"
        inputMode="decimal"
        style={styles.input}
        selectionColor={colors.primary}
        autoFocus={autoFocus}
        allowFontScaling={false}
        accessibilityLabel="Amount in dollars"
        maxLength={12}
      />
    </View>
  );
}

const AMOUNT_SIZE = 52;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  symbol: {
    fontFamily: fontFamily.semibold,
    fontSize: AMOUNT_SIZE,
    lineHeight: AMOUNT_SIZE + 6,
    color: colors.primary,
    marginRight: 2,
  },
  input: {
    fontFamily: fontFamily.semibold,
    fontSize: AMOUNT_SIZE,
    lineHeight: AMOUNT_SIZE + 6,
    color: colors.primary,
    minWidth: 60,
    padding: 0,
    fontVariant: ['tabular-nums'],
    textAlign: 'left',
  },
});
