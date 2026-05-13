import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { C } from '../../constants/colors';

export default function ConsumerLayout() {
  const { t } = useTranslation();
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
      <Tabs.Screen name="dashboard" options={{ title: t('nav.home'),     tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="recipes"   options={{ title: t('nav.recipes'),  tabBarIcon: () => <Text style={{ fontSize: 20 }}>👨‍🍳</Text> }} />
      <Tabs.Screen name="dine"      options={{ title: t('nav.discover'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>🍽️</Text> }} />
      <Tabs.Screen name="pairings"  options={{ title: t('nav.pairings'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>🍷</Text> }} />
      <Tabs.Screen name="music"     options={{ title: t('nav.music'),    tabBarIcon: () => <Text style={{ fontSize: 20 }}>🎵</Text> }} />
      <Tabs.Screen name="profile"   options={{ title: t('nav.profile'),  tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
      {/* Hidden from the tab bar (href: null) but reachable via router.push
          from the dashboard. The tab bar already has 6 entries; a 7th
          would crowd the layout. Planner is now a hidden secondary
          feature reachable from the dashboard quick actions — its
          tab slot was reassigned to Dine after the consumer/diner
          unification (Option B). */}
      <Tabs.Screen name="planner"        options={{ href: null }} />
      <Tabs.Screen name="assistant"      options={{ href: null }} />
      <Tabs.Screen name="social"         options={{ href: null }} />
      <Tabs.Screen name="pantry"         options={{ href: null }} />
      <Tabs.Screen name="journal"        options={{ href: null }} />
      <Tabs.Screen name="order"          options={{ href: null }} />
      <Tabs.Screen name="guided-cooking" options={{ href: null }} />
      <Tabs.Screen name="cellar"         options={{ href: null }} />
    </Tabs>
  );
}
