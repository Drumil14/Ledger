import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { Divider } from '@/components/divider';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { SecondaryButton } from '@/components/secondary-button';
import { Text } from '@/components/text';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useDemo } from '@/features/demo/demo-context';
import { haptics } from '@/lib/haptics';

const FUTURE_SETTINGS = [
  'Monthly budget',
  'Notifications',
  'Currency',
  'Data & privacy',
  'Export data',
];

export default function Profile() {
  const { session, signOut } = useAuth();
  const { isDemoMode, exitDemo, resetDemo } = useDemo();
  const router = useRouter();

  const [resetConfirming, setResetConfirming] = useState(false);

  const openRecurring = () => {
    haptics.light();
    router.push('/recurring');
  };

  const openNotifications = () => {
    haptics.light();
    router.push('/notifications');
  };

  const email = isDemoMode ? '' : session?.user.email ?? '';
  const metadata = session?.user.user_metadata as { full_name?: string } | undefined;
  const name = isDemoMode ? 'Demo' : metadata?.full_name?.trim() || 'Your account';
  const subtitle = isDemoMode ? 'Exploring with sample data' : email;
  const initial = (name[0] ?? 'L').toUpperCase();

  const onSignOut = () => {
    haptics.warning();
    void signOut();
  };

  const onExitDemo = () => {
    haptics.warning();
    exitDemo();
  };

  const onResetDemo = () => {
    setResetConfirming(false);
    haptics.success();
    resetDemo();
  };

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Profile" />

        <View style={styles.account}>
        <View style={styles.avatar}>
          <Text variant="sectionTitle" color={colors.onPrimary}>
            {initial}
          </Text>
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text variant="rowTitle">{name}</Text>
            {isDemoMode ? (
              <View style={styles.demoBadge}>
                <Text variant="metadata" color={colors.textSecondary} style={styles.demoBadgeText}>
                  DEMO
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text variant="metadata" color={colors.textSecondary}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.manage}>
        <Text variant="metadata" color={colors.disabled} style={styles.sectionLabel}>
          MANAGE
        </Text>
        <Divider />
        <Pressable
          onPress={openRecurring}
          accessibilityRole="button"
          accessibilityLabel="Recurring expenses"
        >
          <View style={styles.row}>
            <Text variant="body">Recurring expenses</Text>
            <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
          </View>
        </Pressable>
        <Divider />
        <Pressable
          onPress={openNotifications}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <View style={styles.row}>
            <Text variant="body">Notifications</Text>
            <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
          </View>
        </Pressable>
        <Divider />
      </View>

      <View style={styles.section}>
        <Text variant="metadata" color={colors.disabled} style={styles.sectionLabel}>
          SETTINGS
        </Text>
        <Divider />
        {FUTURE_SETTINGS.map((label) => (
          <View key={label}>
            <View style={styles.row}>
              <Text variant="body" color={colors.disabled}>
                {label}
              </Text>
              <Text variant="metadata" color={colors.disabled}>
                Soon
              </Text>
            </View>
            <Divider />
          </View>
        ))}
      </View>

        <View style={styles.signOut}>
          {isDemoMode ? (
            <View style={styles.demoActions}>
              <SecondaryButton label="Reset demo data" onPress={() => setResetConfirming(true)} />
              <SecondaryButton label="Exit demo" onPress={onExitDemo} />
            </View>
          ) : (
            <SecondaryButton label="Sign out" onPress={onSignOut} />
          )}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={resetConfirming}
        title="Reset demo data?"
        message="This will restore the original demo transactions and settings."
        confirmLabel="Reset"
        onConfirm={onResetDemo}
        onClose={() => setResetConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  demoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  demoBadgeText: {
    fontFamily: fontFamily.medium,
    letterSpacing: 1,
  },
  demoActions: {
    gap: spacing.md,
  },
  manage: {
    marginBottom: spacing.xxl,
  },
  section: {
    flex: 1,
  },
  sectionLabel: {
    fontFamily: fontFamily.medium,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  signOut: {
    paddingVertical: spacing.xl,
  },
});
