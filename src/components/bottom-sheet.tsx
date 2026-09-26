import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, StyleSheet, View } from 'react-native';
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

/**
 * Minimal, monochrome bottom sheet. Native <Modal> host + a Reanimated slide,
 * a scrim that taps to dismiss, and a grabber. Honours reduced motion.
 */
export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const [panelHeight, setPanelHeight] = useState(360);

  // Mount on open, and keep mounted through the close animation before
  // unmounting — a delayed-unmount pattern that inherently sets state here.
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

  return (
    <Modal visible={mounted} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
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
    </Modal>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
