import { Pressable } from 'react-native';

import { Text } from '@/components/text';
import { colors, fontFamily } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type Props = {
  label: string;
  onPress: () => void;
};

/** Inline text button (monochrome, semibold), for "Log in", "Forgot password?" etc. */
export function TextLink({ label, onPress }: Props) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text variant="body" color={colors.primary} style={{ fontFamily: fontFamily.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}
