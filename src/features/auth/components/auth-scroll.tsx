import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { colors, spacing } from '@/constants/theme';

/** Matches exactly what Animated.View accepts (incl. animated style handles). */
type AnimatedViewStyle = React.ComponentProps<typeof Animated.View>['style'];

type Props = {
  children: React.ReactNode;
  /** Animated lift/fade applied on successful submit. */
  containerStyle?: AnimatedViewStyle;
  /** Hide the back chevron (unused for now, but keeps the shell flexible). */
  hideBack?: boolean;
};

/**
 * Shared shell for the register/login screens: safe area, keyboard avoidance,
 * a scrollable body, back navigation and the success lift/fade container.
 */
export function AuthScroll({ children, containerStyle, hideBack }: Props) {
  const { back } = useRouter();

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.flex, containerStyle]}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {hideBack ? null : (
              <PressableScale
                onPress={back}
                haptic="selection"
                accessibilityLabel="Go back"
                style={styles.back}
              >
                <ArrowLeft size={24} color={colors.primary} strokeWidth={2} />
              </PressableScale>
            )}
            <View style={styles.body}>{children}</View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
});
