/**
 * Device frame — web.
 *
 * Desktop: centres the Ledger app inside a minimal, monochrome phone-shaped shell
 * (~390×844 usable screen) on the warm-white page. The shell is pure CSS / RNW —
 * no copyrighted assets, and the word "iPhone" never appears. A nested
 * `SafeAreaProvider` gives the app a realistic status-bar / home-indicator inset
 * so content never sits under the Dynamic-Island treatment or the screen edges.
 *
 * The screen container carries a transform, which makes it the containing block
 * for any `position: fixed` descendants (e.g. the web bottom sheet) AND clips them
 * with `overflow: hidden` — so overlays stay inside the phone instead of covering
 * the whole browser.
 *
 * Mobile browser (≤600px): no fake phone — the app uses the full viewport.
 */

import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { colors, fontFamily, spacing } from '@/constants/theme';

const SCREEN_W = 390;
const SCREEN_H = 844;
const BEZEL = 12;
const MOBILE_BREAKPOINT = 600;
const GITHUB_URL = 'https://github.com/Drumil14/Ledger';

// Deterministic insets for the simulated screen: a status-bar band up top (below
// the island) and a home-indicator band at the bottom. These are provided via
// context directly — RNW's SafeAreaProvider re-measures the DOM and would
// collapse them to 0, jamming titles under the island.
const FRAME_INSETS = { top: 44, right: 0, bottom: 24, left: 0 };

export function DeviceFrame({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();

  // Mobile browser: use the screen normally, no device shell.
  if (width <= MOBILE_BREAKPOINT) {
    return <View style={styles.mobileRoot}>{children}</View>;
  }

  // Desktop: fit the phone to the viewport height (approx. 390×844), leaving room
  // for the caption. Width stays fixed; only the height flexes on short windows.
  const screenH = Math.min(SCREEN_H, Math.max(480, Math.round(height - 132)));

  return (
    <View style={styles.page}>
      <View style={[styles.deviceBody, { height: screenH + BEZEL * 2 }]}>
        <View style={[styles.screen, { height: screenH }]}>
          <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width: SCREEN_W, height: screenH }}>
            <SafeAreaInsetsContext.Provider value={FRAME_INSETS}>
              {children}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
          <View style={styles.island} pointerEvents="none" />
        </View>
      </View>

      <View style={styles.caption}>
        <Text style={styles.captionText}>Interactive demo · No account required</Text>
        <Pressable
          onPress={() => void Linking.openURL(GITHUB_URL)}
          accessibilityRole="link"
          accessibilityLabel="View source on GitHub"
        >
          <Text style={styles.link}>GitHub ↗</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  deviceBody: {
    width: SCREEN_W + BEZEL * 2,
    backgroundColor: '#0B0B0C',
    borderRadius: 58,
    borderCurve: 'continuous',
    padding: BEZEL,
    borderWidth: 1,
    borderColor: '#232326',
    // Soft, monochrome depth (RNW maps these to box-shadow).
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
  },
  screen: {
    width: SCREEN_W,
    backgroundColor: colors.background,
    borderRadius: 46,
    borderCurve: 'continuous',
    overflow: 'hidden',
    position: 'relative',
    // A transform makes this the containing block for fixed-position overlays,
    // keeping web bottom sheets clipped inside the phone.
    transform: [{ translateX: 0 }],
  },
  island: {
    position: 'absolute',
    top: 9,
    left: (SCREEN_W - 112) / 2,
    width: 112,
    height: 30,
    borderRadius: 16,
    backgroundColor: '#000000',
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  captionText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  link: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.primary,
  },
});
