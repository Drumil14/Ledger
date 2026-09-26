import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { ButtonState } from '@/components/primary-button';
import { haptics } from '@/lib/haptics';

type AuthAction = () => Promise<{ error: string | null }>;

/**
 * Drives the post-auth hand-off: submit → spinner → (error surfaces, or) success
 * tick + haptic → the form lifts and fades while the app enters underneath.
 * The actual auth request is injected, so login/register share this choreography.
 */
export function useAuthTransition() {
  const { replace } = useRouter();
  const reduceMotion = useReducedMotion();
  const [buttonState, setButtonState] = useState<ButtonState>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const leaving = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(leaving.get(), [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(leaving.get(), [0, 1], [0, -24]) }],
  }));

  const goHome = () => replace('/home');

  const run = async (action: AuthAction) => {
    if (buttonState !== 'idle') return;
    setFormError(null);
    setButtonState('loading');

    const { error } = await action();

    if (error) {
      setButtonState('idle');
      setFormError(error);
      haptics.error();
      return;
    }

    setButtonState('success');
    haptics.success();

    if (reduceMotion) {
      setTimeout(goHome, 260);
      return;
    }

    leaving.set(
      withDelay(
        220,
        withTiming(1, { duration: 380, easing: Easing.in(Easing.ease) }, (finished) => {
          'worklet';
          if (finished) runOnJS(goHome)();
        })
      )
    );
  };

  return { buttonState, containerStyle, formError, run };
}
