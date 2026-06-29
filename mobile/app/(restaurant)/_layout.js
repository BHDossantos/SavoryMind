import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { C } from '../../constants/colors';

export default function RestaurantLayout() {
  const { t } = useTranslation();
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
      <Tabs.Screen name="dashboard"       options={{ title: t('nav.dashboard'), tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }} />
      <Tabs.Screen name="menu"            options={{ title: t('nav.menu'),      tabBarIcon: ({ color }) => <TabIcon icon="🍽️" color={color} /> }} />
      <Tabs.Screen name="assistant"       options={{ title: t('nav.assistant'), tabBarIcon: ({ color }) => <TabIcon icon="👨‍🍳" color={color} /> }} />
      <Tabs.Screen name="sentiment"       options={{ title: t('nav.sentiment'), tabBarIcon: ({ color }) => <TabIcon icon="💬" color={color} /> }} />
      <Tabs.Screen name="more"            options={{ title: t('nav.more'),      tabBarIcon: ({ color }) => <TabIcon icon="⋯" color={color} /> }} />
      {/* Hidden from the tab bar — still reachable via direct route push. */}
      <Tabs.Screen name="recommendations" options={{ href: null }} />
      {/* Hidden from the tab bar — reachable from the More screen. */}
      <Tabs.Screen name="employees"       options={{ href: null }} />
      <Tabs.Screen name="inventory"       options={{ href: null }} />
      <Tabs.Screen name="billing"         options={{ href: null }} />
    </Tabs>
  );
}

function TabIcon({ icon, color }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
