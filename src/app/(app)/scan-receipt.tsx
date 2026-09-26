import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Zap, ZapOff } from 'lucide-react-native';

import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

// The camera viewfinder is an intentional high-contrast dark context: pure
// black/white from the design tokens, with translucent whites for legibility
// over the live camera feed (no token equivalent exists for those overlays).
const WHITE = colors.surface;
const BLACK = colors.ink;

export default function ScanReceipt() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const goToReceipt = (uri: string, source: 'camera' | 'library') => {
    router.replace({ pathname: '/receipt', params: { uri, source } });
  };

  const choosePhoto = async () => {
    haptics.selection();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    goToReceipt(result.assets[0].uri, 'library');
  };

  const capture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (photo?.uri) {
        haptics.medium();
        setPhotoUri(photo.uri);
      }
    } finally {
      setCapturing(false);
    }
  };

  // --- Loading permission ---
  if (!permission) {
    return <View style={styles.black} />;
  }

  // --- Permission not granted ---
  if (!permission.granted) {
    return (
      <View style={[styles.black, styles.denied, { paddingTop: insets.top + spacing.xxl }]}>
        <View style={styles.deniedBody}>
          <Text variant="pageTitle" color={WHITE}>
            Camera access is off.
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.7)" style={styles.deniedCopy}>
            Ledger needs camera access to scan receipts.
          </Text>
        </View>
        <View style={styles.deniedActions}>
          {permission.canAskAgain ? (
            <PrimaryButton label="Allow camera access" onPress={() => void requestPermission()} />
          ) : (
            <PrimaryButton label="Open Settings" onPress={() => void Linking.openSettings()} />
          )}
          <SecondaryButton label="Choose photo instead" onPress={() => void choosePhoto()} />
          <Pressable onPress={() => router.back()} style={styles.cancelLink} accessibilityRole="button">
            <Text variant="button" color="rgba(255,255,255,0.7)">
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- Capture review ---
  if (photoUri) {
    return (
      <View style={[styles.black, { paddingTop: insets.top + spacing.md }]}>
        <Text variant="sectionTitle" color={WHITE} style={styles.reviewTitle}>
          Receipt
        </Text>
        <View style={styles.reviewImageWrap}>
          <Image
            source={{ uri: photoUri }}
            style={styles.reviewImage}
            contentFit="contain"
            accessibilityLabel="Captured receipt"
          />
        </View>
        <View style={[styles.reviewActions, { paddingBottom: insets.bottom + spacing.lg }]}>
          <PrimaryButton label="Use receipt" onPress={() => goToReceipt(photoUri, 'camera')} />
          <SecondaryButton
            label="Retake"
            onPress={() => {
              haptics.light();
              setPhotoUri(null);
            }}
          />
        </View>
      </View>
    );
  }

  // --- Camera ---
  return (
    <View style={styles.black}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text variant="button" color={WHITE}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.selection();
            setTorch((prev) => !prev);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Flash"
          accessibilityState={{ selected: torch }}
        >
          {torch ? <Zap size={24} color={WHITE} /> : <ZapOff size={24} color={WHITE} />}
        </Pressable>
      </View>

      <View style={styles.frameArea} pointerEvents="none">
        <View style={styles.frame}>
          <Text variant="metadata" color="rgba(255,255,255,0.85)" center>
            Place receipt inside frame
          </Text>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable
          onPress={() => void capture()}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Capture receipt"
          style={styles.shutterOuter}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: {
    flex: 1,
    backgroundColor: BLACK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  frameArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  frame: {
    width: '100%',
    aspectRatio: 0.72,
    maxHeight: '78%',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.lg,
  },
  controls: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: WHITE,
  },
  denied: {
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  deniedBody: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  deniedCopy: {
    maxWidth: 300,
  },
  deniedActions: {
    gap: spacing.md,
  },
  cancelLink: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  reviewImageWrap: {
    flex: 1,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  reviewImage: {
    flex: 1,
  },
  reviewActions: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
});
