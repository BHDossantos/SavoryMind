import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

export default function VenueDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [v, setV] = useState<any>(null);
  useEffect(() => { api.get<any>(`/api/venues/${slug}`).then(setV); }, [slug]);
  if (!v) return <Text style={[styles.dim, { padding: 20 }]}>Loading…</Text>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>{v.neighborhood} · {v.type}</Text>
      <Text style={styles.h1}>{v.name}</Text>
      <Text style={styles.dim}>{v.description}</Text>

      <View style={{ marginTop: 16 }}>
        <Row label="Address" value={v.address} />
        <Row label="Avg / pp" value={`€${v.avg_price_eur}`} />
        <Row label="Dress" value={v.dress_code} />
        <Row label="Reservation" value={v.reservation_required ? 'Required' : 'Walk-in OK'} />
        <Row label="VIP table" value={v.vip_available ? 'Available' : '—'} />
        <Row label="Best arrival" value={v.best_arrival_time || '—'} />
        <Row label="Music" value={(v.music_types || []).join(', ') || '—'} />
      </View>

      <Pressable style={[styles.btn, { marginTop: 24 }]} onPress={() => router.push(`/bookings/new?venue_id=${v.id}`)}>
        <Text style={styles.btnText}>Request reservation</Text>
      </Pressable>
      {v.vip_available && (
        <Pressable style={styles.btnSecondary} onPress={() => router.push(`/bookings/new?venue_id=${v.id}&request_type=vip_table`)}>
          <Text style={styles.btnSecondaryText}>Request VIP table</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ color: colors.text }}>{value}</Text>
    </View>
  );
}
