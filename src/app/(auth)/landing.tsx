import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { colors, duration, spacing } from '@/constants/theme';
import { useDemo } from '@/features/demo/demo-context';
import { haptics } from '@/lib/haptics';

export default function Landing() {
  const { push } = useRouter();
  const { enterDemo } = useDemo();

  const onExploreDemo = () => {
    haptics.selection();
    enterDemo();
  };

  return (
    <Screen style={styles.screen}>
      <Animated.View entering={FadeInDown.duration(duration.xslow)}>
        <Text variant="logo" style={styles.logo}>
          Ledger
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(duration.xslow).delay(90)}
        style={styles.headline}
      >
        <Text variant="pageTitle">Know where{'\n'}your money goes.</Text>
        <Text variant="sectionTitle" color={colors.textSecondary}>
          Without thinking about it.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(duration.xslow).delay(180)}
        style={styles.actions}
      >
        <PrimaryButton label="Create account" onPress={() => push('/register')} />
        <SecondaryButton label="Log in" onPress={() => push('/login')} />
        <Pressable
          onPress={onExploreDemo}
          style={styles.demo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Explore demo"
          accessibilityHint="Explore Ledger with sample data — no account needed"
        >
          <Text variant="button" color={colors.textSecondary} center>
            Explore demo
          </Text>
        </Pressable>
        <Text variant="metadata" color={colors.disabled} center style={styles.legal}>
          By continuing you agree to our Privacy Policy and Terms of Service.
        </Text>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  logo: {
    letterSpacing: -1.8,
  },
  headline: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  demo: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  legal: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
});
