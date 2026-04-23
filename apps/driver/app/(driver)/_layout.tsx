import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../constants/colors';

function TabIcon({ emoji, label, focused, colors }: { emoji: string; label: string; focused: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.tabItem, focused && { backgroundColor: colors.accent + '1A' }]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.textMut }]}>{label}</Text>
    </View>
  );
}

export default function DriverLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const tabBarHeight = 56 + (Platform.OS === 'android' ? insets.bottom : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'android' ? insets.bottom : 8,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺" label="Map" focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="earnings/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💰" label="Earnings" focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="incentives"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" label="Bonus" focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🚗" label="Vehicle" focused={focused} colors={colors} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} colors={colors} />,
        }}
      />

      {/* Hidden from tab bar */}
      <Tabs.Screen name="request" options={{ href: null }} />
      <Tabs.Screen name="trip" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="onboarding/agreement" options={{ href: null }} />
      <Tabs.Screen name="onboarding/personal-docs" options={{ href: null }} />
      <Tabs.Screen name="onboarding/vehicle-docs" options={{ href: null }} />
      <Tabs.Screen name="onboarding/pending" options={{ href: null }} />
      <Tabs.Screen name="onboarding/_layout" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tabEmoji: { fontSize: 20 },
  tabLabel: { fontSize: 10, marginTop: 2, fontWeight: '600' },
});
