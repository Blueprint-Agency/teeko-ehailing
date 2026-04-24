import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../../constants/colors';

function TabIcon({ emoji, label, focused, colors }: { emoji: string; label: string; focused: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.tabItem, focused && { backgroundColor: colors.accent + '1A' }]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.textMut }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

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
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 11, marginTop: 4, fontWeight: '700' },
});
