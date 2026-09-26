import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Eye, EyeOff } from 'lucide-react-native';

import { Text } from '@/components/text';
import { colors, radius, spacing, typography } from '@/constants/theme';

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  /** Renders as a password field with a show/hide toggle. */
  secure?: boolean;
};

/**
 * Labelled text input. Thin bordered field (radius 10), monochrome error state,
 * and an optional password reveal. `ref` forwards to the inner TextInput so
 * screens can chain focus (name → email → password).
 */
export const FormField = forwardRef<TextInput, Props>(function FormField(
  { label, value, onChangeText, error, secure = false, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const borderColor = error || focused ? colors.primary : colors.divider;
  const hasError = !!error;

  return (
    <View style={styles.container}>
      <Text variant="metadata" color={colors.textSecondary} style={styles.label}>
        {label}
      </Text>

      <View style={[styles.field, { borderColor }]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          placeholderTextColor={colors.disabled}
          secureTextEntry={secure ? !reveal : false}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          {...rest}
        />

        {secure ? (
          <Pressable
            onPress={() => setReveal((prev) => !prev)}
            hitSlop={12}
            style={styles.reveal}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? (
              <EyeOff size={20} color={colors.textSecondary} strokeWidth={1.8} />
            ) : (
              <Eye size={20} color={colors.textSecondary} strokeWidth={1.8} />
            )}
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
          <Text variant="metadata" color={colors.primary} style={styles.error}>
            {error}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.primary,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    padding: 0,
  },
  reveal: {
    paddingLeft: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginLeft: spacing.xs,
    fontFamily: typography.metadata.fontFamily,
  },
});
