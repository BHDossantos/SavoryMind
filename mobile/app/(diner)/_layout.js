import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { C } from '../../constants/colors';

export default function DinerLayout() {
  const { t } = useTranslation();
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
      <Tabs.Screen name="dashboard" options={{ title: t('nav.home'),     tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="discover"  options={{ title: t('nav.discover'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔍</Text> }} />
      <Tabs.Screen name="book"      options={{ title: t('nav.book'),     tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text> }} />
      <Tabs.Screen name="history"   options={{ title: t('nav.history'),  tabBarIcon: () => <Text style={{ fontSize: 20 }}>📖</Text> }} />
      <Tabs.Screen name="profile"   options={{ title: t('nav.profile'),  tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
    </Tabs>
  );
}
