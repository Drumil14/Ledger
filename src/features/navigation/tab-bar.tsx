import { useState } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, PieChart, Plus, Receipt, User, type LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/text';
import { colors, fontFamily, hairline, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { AddActionSheet } from '@/features/receipts/components/add-action-sheet';

// Derive the tab-bar props straight from Expo Router's Tabs (it vendors its own
// bottom-tabs types), avoiding a clash with @react-navigation/bottom-tabs.
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

type TabConfig = { label: string; Icon: LucideIcon };

const TABS: Record<string, TabConfig> = {
  home: { label: 'Home', Icon: House },
  transactions: { label: 'Activity', Icon: Receipt },
  insights: { label: 'Insights', Icon: PieChart },
  profile: { label: 'Profile', Icon: User },
};

/**
 * Minimal monochrome tab bar. Active = ink, inactive = grey. The centre Add
 * action (a solid dark tile — still monochrome) opens the Add Expense modal.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [addOpen, setAddOpen] = useState(false);

  const renderTab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const config = TABS[route.name];
    if (!config) return null;

    const isFocused = state.index === index;
    const { Icon, label } = config;
    const tint = isFocused ? colors.primary : colors.disabled;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        haptics.light();
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        <Icon size={23} color={tint} strokeWidth={isFocused ? 2.1 : 1.8} />
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.bar, { paddingBottom: insets.bottom || spacing.sm }]}>
        {renderTab(0)}
        {renderTab(1)}
        <Pressable
          onPress={() => {
            haptics.selection();
            setAddOpen(true);
          }}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
        >
          <View style={styles.addTile}>
            <Plus size={24} color={colors.onPrimary} strokeWidth={2.2} />
          </View>
        </Pressable>
        {renderTab(2)}
        {renderTab(3)}
      </View>
      <AddActionSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopWidth: hairline,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  addTile: {
    width: 46,
    height: 40,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
