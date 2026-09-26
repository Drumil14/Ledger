import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Divider } from '@/components/divider';
import { ModalHeader } from '@/components/modal-header';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { colors, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { PermissionSheet } from '@/features/notifications/components/permission-sheet';
import { useNotifications } from '@/features/notifications/notifications-provider';
import {
  RECURRING_LEAD_OPTIONS,
  type NotificationPreferences,
  type RecurringLeadDays,
} from '@/features/notifications/types';

type ToggleKey = 'recurringEnabled' | 'budgetEnabled' | 'monthlySummaryEnabled';

const LEAD_LABELS: Record<RecurringLeadDays, string> = {
  1: '1 day before',
  3: '3 days before',
  7: '7 days before',
};

export default function NotificationsSettings() {
  const { back } = useRouter();
  const { preferences, permissionStatus, setPreferences, requestPermission, refreshPermission } =
    useNotifications();

  const [permissionSheet, setPermissionSheet] = useState<'prompt' | 'denied' | null>(null);
  const [timingSheet, setTimingSheet] = useState(false);

  const onToggle = (key: ToggleKey, value: boolean) => {
    haptics.selection();
    setPreferences({ [key]: value } as Partial<NotificationPreferences>);
    // Ask for permission only when a feature is switched on.
    if (value && permissionStatus !== 'granted') {
      setPermissionSheet(permissionStatus === 'denied' ? 'denied' : 'prompt');
    }
  };

  const onEnablePermission = async () => {
    const status = await requestPermission();
    if (status === 'granted') {
      setPermissionSheet(null);
      haptics.success();
    } else {
      setPermissionSheet('denied');
    }
  };

  const onOpenSettings = () => {
    setPermissionSheet(null);
    void Linking.openSettings();
  };

  const onSelectLead = (lead: RecurringLeadDays) => {
    haptics.selection();
    setPreferences({ recurringLeadDays: lead });
    setTimingSheet(false);
  };

  const showDeniedNotice =
    permissionStatus === 'denied' &&
    (preferences.recurringEnabled ||
      preferences.budgetEnabled ||
      preferences.monthlySummaryEnabled);

  return (
    <Screen edges={['top']}>
      <ModalHeader title="Notifications" onClose={back} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Divider />
          <ToggleRow
            label="Recurring charges"
            hint="Remind me before an expected charge"
            value={preferences.recurringEnabled}
            onValueChange={(v) => onToggle('recurringEnabled', v)}
          />
          <Divider />
          <ToggleRow
            label="Budget progress"
            hint="Alert at 75%, 90% and 100%"
            value={preferences.budgetEnabled}
            onValueChange={(v) => onToggle('budgetEnabled', v)}
          />
          <Divider />
          <ToggleRow
            label="Monthly summary"
            hint="A recap on the 1st of each month"
            value={preferences.monthlySummaryEnabled}
            onValueChange={(v) => onToggle('monthlySummaryEnabled', v)}
          />
          <Divider />
        </View>

        <View style={styles.section}>
          <Text variant="metadata" color={colors.disabled} style={styles.sectionLabel}>
            RECURRING REMINDER
          </Text>
          <Divider />
          <Pressable
            onPress={() => {
              haptics.light();
              setTimingSheet(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Recurring reminder timing, ${LEAD_LABELS[preferences.recurringLeadDays]}`}
          >
            <View style={styles.row}>
              <Text variant="body">{LEAD_LABELS[preferences.recurringLeadDays]}</Text>
              <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
          </Pressable>
          <Divider />
        </View>

        {showDeniedNotice ? (
          <View style={styles.notice}>
            <Text variant="metadata" color={colors.textSecondary}>
              Notifications are turned off in your device settings.
            </Text>
            <TextLink label="Open Settings" onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
      </ScrollView>

      <PermissionSheet
        visible={permissionSheet !== null}
        mode={permissionSheet ?? 'prompt'}
        onEnable={onEnablePermission}
        onOpenSettings={onOpenSettings}
        onClose={() => {
          setPermissionSheet(null);
          void refreshPermission();
        }}
      />

      <BottomSheet visible={timingSheet} onClose={() => setTimingSheet(false)} title="Remind me">
        <View>
          {RECURRING_LEAD_OPTIONS.map((lead, index) => {
            const selected = preferences.recurringLeadDays === lead;
            return (
              <View key={lead}>
                <Pressable
                  onPress={() => onSelectLead(lead)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={LEAD_LABELS[lead]}
                >
                  <View style={styles.optionRow}>
                    <Text variant="body">{LEAD_LABELS[lead]}</Text>
                    {selected ? (
                      <Check size={20} color={colors.primary} strokeWidth={2} />
                    ) : null}
                  </View>
                </Pressable>
                {index < RECURRING_LEAD_OPTIONS.length - 1 ? <Divider /> : null}
              </View>
            );
          })}
        </View>
      </BottomSheet>
    </Screen>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="body">{label}</Text>
        <Text variant="metadata" color={colors.textSecondary}>
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.divider, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.divider}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionLabel: {
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 56,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    minHeight: 52,
  },
  notice: {
    gap: spacing.sm,
  },
});
