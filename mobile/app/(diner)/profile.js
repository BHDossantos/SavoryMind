import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const REC_ICON = {
  try_new_cuisine:     '🌍',
  revisit_favourite:   '🔁',
  book_ahead:          '📅',
  explore_local:       '📍',
  default:             '💡',
};

export default function DinerProfile() {
  const { user, logout }       = useAuth();
  const [summary, setSummary]   = useState(null);
  const [visits, setVisits]     = useState([]);
  const [recs, setRecs]         = useState([]);

  const load = async () => {
    try {
      const [s, v, r] = await Promise.all([
        api.getDinerSummary(),
        api.getDinerVisits(),
        api.getDinerRecommendations().catch(() => []),
      ]);
      setSummary(s); setVisits(v); setRecs(r.slice(0, 3));
    } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const topRestaurants = visits.reduce((acc, v) => {
    if (!acc[v.restaurant_name]) acc[v.restaurant_name] = { count: 0, total: 0 };
    acc[v.restaurant_name].count++;
    acc[v.restaurant_name].total += v.overall_rating || 0;
    return acc;
  }, {});

  const sorted = Object.entries(topRestaurants)
    .map(([name, { count, total }]) => ({ name, count, avg: total / count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Sign out</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.display_name || 'U')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.display_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {summary && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Your Dining Stats</Text>
            <View style={styles.statsRow}>
              <StatItem label="Total Visits"  value={summary.total_visits ?? 0} />
              <StatItem label="Avg Rating"    value={(summary.avg_rating ?? 0).toFixed(1)} />
              <StatItem label="Return Rate"   value={`${Math.round((summary.return_rate ?? 0) * 100)}%`} />
            </View>
            {summary.upcoming_bookings > 0 && (
              <Text style={styles.bookingNote}>
                📅 {summary.upcoming_bookings} upcoming {summary.upcoming_bookings === 1 ? 'booking' : 'bookings'}
              </Text>
            )}
          </View>
        )}

        {recs.length > 0 && (
          <View style={styles.recsCard}>
            <Text style={styles.sectionTitle}>Suggestions for You</Text>
            {recs.map((r, i) => (
              <View key={i} style={styles.recRow}>
                <Text style={styles.recIcon}>{REC_ICON[r.type] || REC_ICON.default}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{r.title}</Text>
                  {r.message && <Text style={styles.recMessage}>{r.message}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {sorted.length > 0 && (
          <View style={styles.topCard}>
            <Text style={styles.sectionTitle}>Your Favourite Places</Text>
            {sorted.map((r, i) => (
              <View key={r.name} style={styles.favRow}>
                <Text style={styles.favRank}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.favName}>{r.name}</Text>
                  <Text style={styles.favMeta}>{r.count} {r.count === 1 ? 'visit' : 'visits'} · ⭐ {r.avg.toFixed(1)} avg</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>The more you log, the better your dining profile becomes — bookmark your favourites and build a history worth sharing.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLab}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  logout:      { fontSize: 13, color: C.gray[400] },
  profileCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: C.diner.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:  { color: '#fff', fontSize: 30, fontWeight: '800' },
  name:        { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  email:       { fontSize: 13, color: C.gray[500], marginTop: 3 },
  statsCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 14 },
  statsRow:    { flexDirection: 'row' },
  statVal:     { fontSize: 20, fontWeight: '800', color: C.diner.primary, textAlign: 'center' },
  statLab:     { fontSize: 11, color: C.gray[500], marginTop: 2, textAlign: 'center' },
  bookingNote: { fontSize: 13, color: C.diner.muted, marginTop: 12, fontWeight: '600' },
  recsCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.diner.border },
  recRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  recIcon:     { fontSize: 22, marginTop: 1 },
  recTitle:    { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  recMessage:  { fontSize: 12, color: C.gray[500], marginTop: 3, lineHeight: 17 },
  topCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  favRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  favRank:     { width: 26, height: 26, borderRadius: 13, backgroundColor: C.diner.light, textAlign: 'center', lineHeight: 26, fontSize: 13, fontWeight: '700', color: C.diner.primary },
  favName:     { fontSize: 14, fontWeight: '600', color: C.gray[900] },
  favMeta:     { fontSize: 12, color: C.gray[500], marginTop: 2 },
  tipCard:     { flexDirection: 'row', gap: 12, backgroundColor: C.diner.light, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.diner.border },
  tipIcon:     { fontSize: 22 },
  tipText:     { flex: 1, fontSize: 13, color: C.diner.text, lineHeight: 19 },
});
