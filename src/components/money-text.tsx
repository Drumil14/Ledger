import type { StyleProp, TextStyle } from 'react-native';

import { Text } from '@/components/text';
import { colors } from '@/constants/theme';
import { formatCurrency } from '@/lib/money';

type Variant = 'display' | 'amount';

type Props = {
  amount: number;
  currency?: string;
  variant?: Variant;
  color?: string;
  /** Render as a signed expense, e.g. "-$47.82". */
  showSign?: boolean;
  style?: StyleProp<TextStyle>;
};

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Format a raw amount to a currency string (for inline sentences). */
export function formatMoney(amount: number, currency = 'USD'): string {
  return formatCurrency(amount, currency);
}

/** Currency figure with tabular numerals so digits stay aligned. */
export function MoneyText({
  amount,
  currency = 'USD',
  variant = 'amount',
  color = colors.primary,
  showSign = false,
  style,
}: Props) {
  const value = showSign ? -Math.abs(amount) : Math.abs(amount);
  const formatted = formatCurrency(value, currency);

  // Only the large hero figure shrinks to fit — enough to survive an extreme value
  // on a 320px screen without breaking layout, but never so much it looks tiny.
  // Inline row amounts keep a fixed size so columns of numbers stay aligned.
  const isDisplay = variant === 'display';

  return (
    <Text
      variant={variant}
      color={color}
      style={[tabular, style]}
      numberOfLines={isDisplay ? 1 : undefined}
      adjustsFontSizeToFit={isDisplay || undefined}
      minimumFontScale={isDisplay ? 0.7 : undefined}
    >
      {formatted}
    </Text>
  );
}
