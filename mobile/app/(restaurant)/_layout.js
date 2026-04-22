import { Tabs } from 'expo-router';
import { C } from '../../constants/colors';

export default function RestaurantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.restaurant.primary,
        tabBarInactiveTintColor: C.gray[400],
        tabBarStyle: { borderTopColor: C.gray[100], backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard"       options={{ title: 'Dashboard',   tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }} />
      <Tabs.Screen name="menu"            options={{ title: 'Menu',         tabBarIcon: ({ color }) => <TabIcon icon="🍽️" color={color} /> }} />
      <Tabs.Screen name="sentiment"       options={{ title: 'Sentiment',    tabBarIcon: ({ color }) => <TabIcon icon="💬" color={color} /> }} />
      <Tabs.Screen name="recommendations" options={{ title: 'Insights',     tabBarIcon: ({ color }) => <TabIcon icon="✨" color={color} /> }} />
      <Tabs.Screen name="more"            options={{ title: 'More',         tabBarIcon: ({ color }) => <TabIcon icon="⋯" color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ icon, color }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
