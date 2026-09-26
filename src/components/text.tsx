import { Text as RNText, type TextProps } from 'react-native';

import { colors, typography, type TypographyToken } from '@/constants/theme';

type Props = TextProps & {
  /** Named typographic role from the design system. */
  variant?: TypographyToken;
  /** Colour token value (defaults to primary ink). */
  color?: string;
  center?: boolean;
};

/**
 * The one text primitive. All copy renders through this so hierarchy stays
 * driven by the shared type scale rather than ad-hoc font sizes.
 */
export function Text({ variant = 'body', color = colors.primary, center, style, ...rest }: Props) {
  return (
    <RNText
      style={[typography[variant], { color }, center ? { textAlign: 'center' } : null, style]}
      {...rest}
    />
  );
}
