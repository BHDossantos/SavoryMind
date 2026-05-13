import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '../constants/colors';
// Side-effect import: initialises i18next + registers locale bundles.
// Importing here (rather than per-screen) guarantees t() works the
// instant any screen renders.
import { initI18n } from '../services/i18n';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inApp = ['(restaurant)', '(consumer)', '(diner)', '(staff)'].includes(segments[0]);

    if (!user && inApp) {
      router.replace('/login');
    } else if (user && !inApp && segments[0] !== 'login' && segments[0] !== 'signup') {
      // Food Lover (consumer) and Food Explorer (diner) used to be
      // separate nav trees. Unified into one: both account types land
      // on the consumer shell, which now hosts cook + dine features.
      // Diner-only screens (discover/book/history/restaurant detail)
      // are still in the (diner) route group and reached via the Dine
      // tab + dashboard cards from the consumer shell.
      if (user.account_type === 'staff') router.replace('/(staff)/portal');
      else if (user.account_type === 'consumer' || user.account_type === 'diner') router.replace('/(consumer)/dashboard');
      else router.replace('/(restaurant)/dashboard');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={C.restaurant.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(restaurant)" />
      <Stack.Screen name="(consumer)" />
      <Stack.Screen name="(diner)" />
      <Stack.Screen name="(staff)" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Pulls the SecureStore-stored language preference (if any) and
    // swaps i18n's active locale over from the device default. Fire-
    // and-forget; the device locale (picked synchronously in i18n.js)
    // is a good-enough first paint while this resolves.
    initI18n();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
