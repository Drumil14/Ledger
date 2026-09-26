import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, PencilLine, Sparkles, type LucideIcon } from 'lucide-react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { Text } from '@/components/text';
import { colors, radius, spacing } from '@/constants/theme';
import { useDemo } from '@/features/demo/demo-context';
import { haptics } from '@/lib/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type OptionProps = {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function Option({ Icon, title, subtitle, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.option}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View style={styles.iconTile}>
        <Icon size={22} color={colors.primary} strokeWidth={1.9} />
      </View>
      <View style={styles.optionText}>
        <Text variant="rowTitle">{title}</Text>
        <Text variant="metadata" color={colors.textSecondary}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/** The Add entry point: scan, import, or manual. Monochrome, no illustrations. */
export function AddActionSheet({ visible, onClose }: Props) {
  const { push } = useRouter();
  const { isDemoMode } = useDemo();

  const scan = () => {
    haptics.selection();
    onClose();
    push('/scan-receipt');
  };

  const trySample = () => {
    haptics.selection();
    onClose();
    push({ pathname: '/receipt', params: { demo: '1' } });
  };

  const choosePhoto = async () => {
    haptics.selection();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onClose();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    onClose();
    if (result.canceled || result.assets.length === 0) return;
    push({ pathname: '/receipt', params: { uri: result.assets[0].uri, source: 'library' } });
  };

  const manual = () => {
    haptics.selection();
    onClose();
    push('/add-expense');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add expense">
      <View>
        {/* Camera / photo import can't work in the web recruiter demo, so hide
            them there; native keeps the full set unchanged. */}
        {Platform.OS !== 'web' ? (
          <>
            <Option
              Icon={Camera}
              title="Scan receipt"
              subtitle="Use the camera to capture a receipt"
              onPress={scan}
            />
            <Divider />
            <Option
              Icon={Images}
              title="Choose photo"
              subtitle="Import an existing receipt"
              onPress={() => void choosePhoto()}
            />
            <Divider />
          </>
        ) : null}
        <Option
          Icon={PencilLine}
          title="Enter manually"
          subtitle="Add an expense yourself"
          onPress={manual}
        />
        {isDemoMode ? (
          <>
            <Divider />
            <Option
              Icon={Sparkles}
              title="Try sample receipt"
              subtitle="See receipt scanning with a sample"
              onPress={trySample}
            />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
});
