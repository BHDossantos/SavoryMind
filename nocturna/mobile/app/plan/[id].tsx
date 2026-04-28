import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, Share } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

export default function PlanResults() {
  const router = useRouter();
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => {
    const all = (ids ? ids.split(',') : [id]).filter(Boolean);
    Promise.all(all.map(pid => api.get(`/api/plans/${pid}`))).then(setPlans).catch(() => {});
  }, [id, ids]);

  async function share(p: any) {
    const r = await api.post<{ share_token: string }>(`/api/plans/${p.id}/share`);
    Share.share({ message: `${p.label} — Nocturna plan`, url: `nocturna://plan/share/${r.share_token}` });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Your night, curated</Text>
      <Text style={styles.h1}>Pick a plan</Text>

      {plans.map(p => (
        <View key={p.id} style={[styles.venueCard, { width: '100%', marginTop: 16 }]}>
          <Text style={styles.cardTitle}>{p.label}</Text>
          <Text style={styles.dim}>€{p.estimated_cost_eur} · {p.total_travel_min}m travel · vibe {Math.round(p.vibe_score * 100)}%</Text>
          {p.stops?.map((s: any) => (
            <View key={s.venue_id} style={{ marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.goldDim }}>
              <Text style={styles.dim}>{new Date(s.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.slot_role}</Text>
              <Pressable onPress={() => router.push(`/venues/${s.slug}`)}>
                <Text style={{ color: colors.text, fontWeight: '500' }}>{s.name}</Text>
              </Pressable>
              <Text style={styles.dim}>{s.summary}</Text>
            </View>
          ))}
          <Pressable style={styles.btn} onPress={() => router.push(`/bookings/new?plan_id=${p.id}&venue_id=${p.stops[0]?.venue_id}`)}>
            <Text style={styles.btnText}>Book this plan</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => share(p)}>
            <Text style={styles.btnSecondaryText}>Share</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={[styles.btnSecondary, { marginTop: 20 }]} onPress={() => router.replace('/plan/new')}>
        <Text style={styles.btnSecondaryText}>Regenerate</Text>
      </Pressable>
    </ScrollView>
  );
}
