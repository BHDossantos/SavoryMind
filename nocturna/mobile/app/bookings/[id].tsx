import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [b, setB] = useState<any>(null);
  useEffect(() => { api.get<any>(`/api/bookings/${id}`).then(setB); }, [id]);
  if (!b) return <Text style={[styles.dim, { padding: 20 }]}>Loading…</Text>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Booking #{b.id}</Text>
      <Text style={styles.h1}>{b.venue?.name}</Text>
      <Text style={styles.dim}>{b.venue?.address}</Text>
      <View style={{ marginTop: 12 }}>
        <Text style={styles.dim}>Status: {b.status}</Text>
        <Text style={styles.dim}>{b.date} {b.time} · {b.group_size} ppl · {b.request_type}</Text>
        {b.vip_interest === 'yes' && <Text style={{ color: colors.gold }}>VIP request</Text>}
        {b.venue_response && <Text style={{ color: colors.text, marginTop: 12 }}>Venue: {b.venue_response}</Text>}
      </View>
      {b.plan_id && (
        <Pressable style={styles.btnSecondary} onPress={() => router.push(`/feedback/${b.plan_id}`)}>
          <Text style={styles.btnSecondaryText}>After your night, leave feedback</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
