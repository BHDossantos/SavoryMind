import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, FlatList } from 'react-native';
import { api } from '@/services/api';
import { registerForPushNotifications } from '@/services/notifications';
import { styles, colors } from '@/lib/theme';

const QUICK = [
  { intent: 'date_night', label: 'Date Night' },
  { intent: 'vip_table', label: 'VIP Table' },
  { intent: 'dinner_drinks', label: 'Dinner + Drinks' },
  { intent: 'dancing', label: 'Clubs Tonight' },
  { intent: 'aperitivo', label: 'Aperitivo' },
  { intent: 'live_music', label: 'Live Music' },
  { intent: 'meet_people', label: 'Meet People' },
  { intent: 'budget', label: 'Budget Night' },
];

export default function Home() {
  const router = useRouter();
  const [trending, setTrending] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>('/api/venues/trending').then(setTrending).catch(() => {});
    registerForPushNotifications().catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Your night, curated</Text>
      <Text style={styles.h1}>Where should we go tonight?</Text>
      <Text style={styles.dim}>Tell us your vibe, your budget, and we'll plan it.</Text>

      <Pressable style={[styles.btn, { marginTop: 24 }]} onPress={() => router.push('/plan/new')}>
        <Text style={styles.btnText}>Plan my night</Text>
      </Pressable>
      <Pressable style={styles.btnSecondary} onPress={() => router.push('/chat')}>
        <Text style={styles.btnSecondaryText}>Ask the concierge</Text>
      </Pressable>
      <Pressable style={styles.btnSecondary} onPress={() => router.push('/groups/new')}>
        <Text style={styles.btnSecondaryText}>Plan with friends</Text>
      </Pressable>

      <Text style={[styles.h2, { marginTop: 28 }]}>What's your night?</Text>
      <View style={styles.grid}>
        {QUICK.map(q => (
          <Pressable key={q.intent} style={styles.card} onPress={() => router.push(`/plan/new?intent=${q.intent}`)}>
            <Text style={styles.cardTitle}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.h2, { marginTop: 28 }]}>Trending venues</Text>
      <FlatList
        horizontal
        data={trending}
        keyExtractor={(v) => String(v.id)}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable style={styles.venueCard} onPress={() => router.push(`/venues/${item.slug}`)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.dim}>{item.neighborhood} · €{item.avg_price_eur}</Text>
          </Pressable>
        )}
      />
      <Pressable onPress={() => router.push('/me/plans')} style={{ marginTop: 28 }}>
        <Text style={{ color: colors.gold, textAlign: 'center' }}>View my plans →</Text>
      </Pressable>
    </ScrollView>
  );
}
