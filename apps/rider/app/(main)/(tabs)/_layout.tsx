import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

type TabIcon = React.ComponentProps<typeof MaterialIcons>['name'];

const ACTIVE = '#E11D2E';
const INACTIVE = '#9CA3AF';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="rides"
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
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, focused }) => icon('home', color, focused) }}
      />
      <Tabs.Screen
        name="rides"
        options={{ title: 'Rides', tabBarIcon: ({ color, focused }) => icon('schedule', color, focused) }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color, focused }) => icon('person', color, focused) }}
      />
    </Tabs>
  );
}

function icon(name: TabIcon, color: string, focused: boolean) {
  return <MaterialIcons name={name} size={focused ? 26 : 24} color={color} />;
}
