import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, Wallet, Target, Car, User } from 'lucide-react-native';
import { useColors } from '../../../constants/colors';
import { useT } from '@teeko/i18n';

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function TabIcon({ Icon, label, focused, colors }: { Icon: LucideIcon; label: string; focused: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.tabItem, focused && { backgroundColor: colors.accent + '1A' }]}>
      <Icon size={22} color={focused ? colors.accent : colors.textMut} strokeWidth={1.75} />
      <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.textMut }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const t = useT();

  const tabBarHeight = 64 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: tabBarHeight,
          width: '100%',
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 10,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarItemStyle: {
          flex: 1,
          height: 48,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Map} label={t('driver.tabMap')} focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="earnings/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Wallet} label={t('driver.tabEarnings')} focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="incentives"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Target} label={t('driver.tabBonus')} focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Car} label={t('driver.tabVehicle')} focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} label={t('driver.tabProfile')} focused={focused} colors={colors} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    width: '100%',
    minWidth: 64,
  },
  tabLabel: { fontSize: 11, marginTop: 4, fontWeight: '700' },
});
