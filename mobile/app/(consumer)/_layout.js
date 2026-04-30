import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../constants/colors';

export default function ConsumerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.consumer.primary,
        tabBarInactiveTintColor: C.gray[400],
        tabBarStyle: { borderTopColor: C.gray[100], backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home',     tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="recipes"   options={{ title: 'Recipes',  tabBarIcon: () => <Text style={{ fontSize: 20 }}>👨‍🍳</Text> }} />
      <Tabs.Screen name="planner"   options={{ title: 'Planner',  tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text> }} />
      <Tabs.Screen name="pairings"  options={{ title: 'Pairings', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🍷</Text> }} />
      <Tabs.Screen name="music"     options={{ title: 'Music',    tabBarIcon: () => <Text style={{ fontSize: 20 }}>🎵</Text> }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile',  tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
      {/* Hidden from the tab bar (href: null) but reachable via router.push
          from the dashboard. The tab bar already has 6 entries; a 7th
          would crowd the layout. */}
      <Tabs.Screen name="assistant" options={{ href: null }} />
    </Tabs>
  );
}
