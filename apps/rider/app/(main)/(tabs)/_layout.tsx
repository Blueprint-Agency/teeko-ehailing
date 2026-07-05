import { MaterialIcons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { useT } from '@teeko/i18n';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { TripProgressStrip } from '../../../components/TripProgressStrip';

type TabIcon = React.ComponentProps<typeof MaterialIcons>['name'];

const ACTIVE = '#E11D2E';
const INACTIVE = '#9CA3AF';

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarStyle: {
          borderTopColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
        },
      }}
      tabBar={(props) => (
        <View>
          <TripProgressStrip />
          <BottomTabBar {...props} />
        </View>
      )}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: ({ color, focused }) => icon('home', color, focused) }}
      />
      <Tabs.Screen
        name="rides"
        options={{ title: t('tabs.rides'), tabBarIcon: ({ color, focused }) => icon('schedule', color, focused) }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tabs.account'), tabBarIcon: ({ color, focused }) => icon('person', color, focused) }}
      />
    </Tabs>
  );
}

function icon(name: TabIcon, color: string, focused: boolean) {
  return <MaterialIcons name={name} size={focused ? 26 : 24} color={color} />;
}
