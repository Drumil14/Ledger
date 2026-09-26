import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  /** Safe-area edges to inset. Defaults to top + bottom. */
  edges?: readonly Edge[];
  /** Applied to the inner content wrapper. */
  style?: ViewStyle;
  /** Skip safe-area handling (e.g. the full-bleed splash). */
  fullBleed?: boolean;
};

/**
 * Screen container: warm-white background + safe-area handling. Keeps every
 * screen visually continuous (same background) so transitions never flash.
 */
export function Screen({ children, edges = ['top', 'bottom'], style, fullBleed }: Props) {
  if (fullBleed) {
    return <View style={[styles.root, style]}>{children}</View>;
  }
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
