import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

export default function MyPlans() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>('/api/plans/me/list').then(setPlans).catch(() => {});
    api.get<any[]>('/api/bookings/me/list').then(setBookings).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>My plans</Text>
      {plans.length === 0 && <Text style={styles.dim}>Sign in to save and view plans.</Text>}
      {plans.map(p => (
        <Pressable key={p.id} style={[styles.venueCard, { width: '100%' }]} onPress={() => router.push(`/plan/${p.id}`)}>
          <Text style={styles.cardTitle}>{p.label}</Text>
          <Text style={styles.dim}>€{p.estimated_cost_eur} · {p.total_travel_min}m · {p.city}</Text>
        </Pressable>
      ))}

      <Text style={[styles.h2, { marginTop: 24 }]}>My bookings</Text>
      {bookings.map(b => (
        <Pressable key={b.id} style={[styles.venueCard, { width: '100%' }]} onPress={() => router.push(`/bookings/${b.id}`)}>
          <Text style={styles.cardTitle}>{b.venue?.name}</Text>
          <Text style={styles.dim}>{b.date} {b.time} · {b.status}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.btnSecondary, { marginTop: 24 }]} onPress={() => router.push('/me/profile')}>
        <Text style={styles.btnSecondaryText}>Edit profile</Text>
      </Pressable>
    </ScrollView>
  );
}
