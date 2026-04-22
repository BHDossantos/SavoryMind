import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

const QUICK = [
  { icon: '🍷', label: 'Wine Pairing',   route: '/(consumer)/pairings' },
  { icon: '🍺', label: 'Beer & Spirits', route: '/(consumer)/pairings' },
  { icon: '🎵', label: 'Music Mood',     route: '/(consumer)/music' },
  { icon: '👨‍🍳', label: 'Recipes',       route: '/(consumer)/recipes' },
];

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [pairings, setPairings] = useState([]);
  const [moods, setMoods] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [p, m] = await Promise.all([api.getWinePairings(), api.getMusicMoods()]);
      setPairings(p.slice(0, 3)); setMoods(m.slice(0, 3));
    } catch {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message="Loading..." color={C.consumer.primary} />;

  return (
    <SafeScreen onRefresh={load}>
      <Text style={styles.greeting}>Hey, {user?.display_name?.split(' ')[0] || 'there'} 👋</Text>
      <Text style={styles.sub}>What are you exploring today?</Text>

      <View style={styles.quickGrid}>
        {QUICK.map((q) => (
          <TouchableOpacity key={q.label} style={[styles.quickCard, { borderColor: C.consumer.border }]} onPress={() => router.push(q.route)} activeOpacity={0.8}>
            <Text style={styles.quickIcon}>{q.icon}</Text>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {pairings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Pairings</Text>
          {pairings.map((p, i) => (
            <View key={i} style={styles.recentCard}>
              <Text style={styles.recentIcon}>🍷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{p.dish}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{p.wine_recommendation}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {moods.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Music Moods</Text>
          {moods.map((m, i) => (
            <View key={i} style={styles.recentCard}>
              <Text style={styles.recentIcon}>🎵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{m.mood} · {m.cuisine}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{m.genre_recommendation}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  greeting:    { fontSize: 26, fontWeight: '800', color: C.gray[900], marginBottom: 4 },
  sub:         { fontSize: 14, color: C.gray[500], marginBottom: 24 },
  quickGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  quickCard:   { width: '47%', backgroundColor: C.consumer.light, borderRadius: 16, padding: 16, borderWidth: 1.5, alignItems: 'center' },
  quickIcon:   { fontSize: 32, marginBottom: 8 },
  quickLabel:  { fontSize: 13, fontWeight: '700', color: C.consumer.text, textAlign: 'center' },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: C.gray[800], marginBottom: 10 },
  recentCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  recentIcon:  { fontSize: 22 },
  recentTitle: { fontSize: 13, fontWeight: '600', color: C.gray[900] },
  recentSub:   { fontSize: 12, color: C.gray[500], marginTop: 2 },
});
