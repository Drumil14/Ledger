/**
 * Bottom sheet — web.
 *
 * The native sheet hosts itself in a React Native `<Modal>`, which react-native-web
 * portals to `document.body` — escaping the phone shell and covering the whole
 * browser. This web variant renders the same monochrome sheet (identical props,
 * animation, scrim, and grabber) as a `position: fixed` overlay *inside* the React
 * tree instead. Inside the device frame it is contained + clipped by the framed
 * screen; on a mobile browser (no frame) it fills the viewport as expected.
 *
 * Behaviour and API are identical to `bottom-sheet.tsx`, so every sheet in the app
 * (confirm, filter, day expenses, add actions, date, …) works unchanged on web.
 */

import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

// `position: 'fixed'` is a web-only value RNW understands but RN's types don't.
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'flex-end',
  zIndex: 1000,
} as unknown as ViewStyle;

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const [panelHeight, setPanelHeight] = useState(360);

  // Mount on open, keep mounted through the close animation before unmounting.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.set(reduceMotion ? 1 : withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
      return;
    }
    if (reduceMotion) {
      progress.set(0);
      setMounted(false);
      return;
    }
    progress.set(
      withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(setMounted)(false);
      })
    );
  }, [visible, reduceMotion, progress]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 1], [0, 1]) }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [panelHeight, 0]) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    setPanelHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
  };

  if (!mounted) return null;

  return (
    <View style={overlayStyle}>
      <AnimatedPressable style={[styles.scrim, scrimStyle]} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View
        style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }, panelStyle]}
        onLayout={onLayout}
      >
        <View style={styles.grabber} />
        {title ? (
          <Text variant="sectionTitle" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {children}
      </Animated.View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 17, 17, 0.35)',
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.md,
  },
});
