import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../constants/colors';

export default function DinerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.diner.primary,
        tabBarInactiveTintColor: C.gray[400],
        tabBarStyle: { borderTopColor: C.gray[100], backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home',     tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="book"      options={{ title: 'Book',     tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text> }} />
      <Tabs.Screen name="history"   options={{ title: 'History',  tabBarIcon: () => <Text style={{ fontSize: 20 }}>📖</Text> }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile',  tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
    </Tabs>
  );
}
