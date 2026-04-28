import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuth } from '@/services/auth';

export default function RootLayout() {
  const init = useAuth(s => s.init);
  useEffect(() => { init(); }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: '#08070d' },
        headerTintColor: '#d4af56',
        headerTitleStyle: { fontWeight: '500' },
        contentStyle: { backgroundColor: '#08070d' },
      }}>
        <Stack.Screen name="index" options={{ title: 'Nocturna' }} />
        <Stack.Screen name="plan/new" options={{ title: 'Plan your night' }} />
        <Stack.Screen name="plan/[id]" options={{ title: 'Your night' }} />
        <Stack.Screen name="venues/[slug]" options={{ title: 'Venue' }} />
        <Stack.Screen name="bookings/new" options={{ title: 'Booking request' }} />
        <Stack.Screen name="bookings/[id]" options={{ title: 'Booking' }} />
        <Stack.Screen name="feedback/[planId]" options={{ title: 'Feedback' }} />
        <Stack.Screen name="chat" options={{ title: 'Concierge' }} />
        <Stack.Screen name="groups/new" options={{ title: 'New group' }} />
        <Stack.Screen name="groups/[token]" options={{ title: 'Group' }} />
        <Stack.Screen name="me/plans" options={{ title: 'My nights' }} />
        <Stack.Screen name="me/profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="auth/login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/signup" options={{ title: 'Sign up' }} />
      </Stack>
    </>
  );
}
