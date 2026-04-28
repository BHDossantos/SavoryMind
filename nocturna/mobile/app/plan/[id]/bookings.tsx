import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View, Pressable, RefreshControl, Linking } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

const STATUS_COLOR: Record<string, string> = {
  new: '#4a4a4a', pending: colors.gold, confirmed: '#43c97b',
  rejected: '#e7615e', cancelled: '#e7615e', completed: '#43c97b', no_show: '#e7615e',
};

export default function PlanBookings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try { setData(await api.get(`/api/bookings/plan/${id}`)); } finally { setRefreshing(false); }
  }
  useEffect(() => { load(); }, [id]);

  if (!data) return <Text style={[styles.dim, { padding: 20 }]}>Loading…</Text>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.gold} />}>
      <Text style={styles.label}>Plan #{data.plan_id} · status</Text>
      <Text style={styles.h1}>Your night</Text>
      <View style={[styles.chip, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#222' }]}>
        <Text style={styles.chipText}>{data.aggregate_status}</Text>
      </View>

      {data.bookings.length === 0 ? (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.dim}>This plan hasn't been booked yet.</Text>
          <Pressable style={styles.btn} onPress={() => router.push(`/bookings/new?plan_id=${id}`)}>
            <Text style={styles.btnText}>Book this plan</Text>
          </Pressable>
        </View>
      ) : data.bookings.map((b: any, i: number) => (
        <View key={b.id} style={[styles.venueCard, { width: '100%', marginTop: 16 }]}>
          <Text style={styles.dim}>Stop {i + 1} · {b.date} {b.time}</Text>
          <Text style={styles.cardTitle}>{b.venue?.name}</Text>
          <Text style={styles.dim}>{b.venue?.address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLOR[b.status] || '#888', marginRight: 8 }} />
            <Text style={{ color: colors.text, textTransform: 'capitalize' }}>{b.status.replace('_', ' ')}</Text>
            <Text style={[styles.dim, { marginLeft: 12 }]}>{b.request_type.replace('_', ' ')} · {b.group_size} ppl</Text>
          </View>
          {b.venue_response ? (
            <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: '#1f1a30' }}>
              <Text style={styles.label}>Venue response</Text>
              <Text style={{ color: colors.text }}>{b.venue_response}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {b.venue?.contact?.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${b.venue.contact.phone}`)} style={{ marginRight: 12 }}>
                <Text style={{ color: colors.gold }}>Call venue</Text>
              </Pressable>
            ) : null}
            {b.venue?.contact?.whatsapp ? (
              <Pressable onPress={() => Linking.openURL(`https://wa.me/${String(b.venue.contact.whatsapp).replace(/\D/g, '')}`)}>
                <Text style={{ color: colors.gold }}>WhatsApp</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <Pressable style={[styles.btnSecondary, { marginTop: 24 }]} onPress={() => router.push(`/feedback/${id}`)}>
        <Text style={styles.btnSecondaryText}>After tonight: leave feedback</Text>
      </Pressable>
    </ScrollView>
  );
}
