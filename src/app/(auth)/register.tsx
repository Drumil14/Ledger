import { useRef } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, type TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { AuthScroll } from '@/features/auth/components/auth-scroll';
import { FormError } from '@/features/auth/components/form-error';
import { registerSchema, type RegisterValues } from '@/features/auth/schema';
import { useAuthTransition } from '@/features/auth/use-auth-transition';
import { haptics } from '@/lib/haptics';

export default function Register() {
  const { replace } = useRouter();
  const { signUp } = useAuth();
  const { buttonState, containerStyle, formError, run } = useAuthTransition();

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(
    (values) => run(() => signUp(values)),
    () => haptics.warning()
  );

  return (
    <AuthScroll containerStyle={containerStyle}>
      <View style={styles.header}>
        <Text variant="pageTitle">Create your account</Text>
        <Text variant="body" color={colors.textSecondary}>
          Start understanding your spending in minutes.
        </Text>
      </View>

      <View style={styles.fields}>
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <FormField
              label="Full name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={fieldState.error?.message}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <FormField
              ref={emailRef}
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={fieldState.error?.message}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <FormField
              ref={passwordRef}
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={fieldState.error?.message}
              secure
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          )}
        />
      </View>

      <View style={styles.submit}>
        <FormError message={formError} />
        <PrimaryButton label="Create account" onPress={onSubmit} state={buttonState} />
      </View>

      <View style={styles.footer}>
        <Text variant="body" color={colors.textSecondary}>
          Already have an account?{' '}
        </Text>
        <TextLink label="Log in" onPress={() => replace('/login')} />
      </View>
    </AuthScroll>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  fields: {
    gap: spacing.lg,
  },
  submit: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
});
