import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ModalHeader } from '@/components/modal-header';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import { getSignedReceiptUrl } from '@/services/receipts';

type State = 'loading' | 'ready' | 'error';

export default function ReceiptView() {
  const router = useRouter();
  const { path } = useLocalSearchParams<{ path: string }>();
  const [state, setState] = useState<State>('loading');
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!path) {
        setState('error');
        return;
      }
      try {
        const signed = await getSignedReceiptUrl(path);
        if (!active) return;
        setUrl(signed);
        setState('ready');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Receipt" onClose={() => router.back()} />
      <View style={styles.body}>
        {state === 'ready' && url ? (
          <Image
            source={{ uri: url }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel="Original receipt"
          />
        ) : (
          <Text variant="body" color={colors.textSecondary} center>
            {state === 'error' ? 'Couldn’t load this receipt.' : 'Loading…'}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  image: {
    flex: 1,
    width: '100%',
  },
});
