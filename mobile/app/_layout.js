import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '../constants/colors';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inApp = ['(restaurant)', '(consumer)', '(diner)'].includes(segments[0]);

    if (!user && inApp) {
      router.replace('/login');
    } else if (user && !inApp && segments[0] !== 'login' && segments[0] !== 'signup') {
      if (user.account_type === 'consumer') router.replace('/(consumer)/dashboard');
      else if (user.account_type === 'diner') router.replace('/(diner)/dashboard');
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
