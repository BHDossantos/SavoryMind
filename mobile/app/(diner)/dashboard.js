import { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

export default function DinerDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [visits, setVisits] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [s, v, b] = await Promise.all([api.getDinerSummary(), api.getDinerVisits(), api.getDinerBookings()]);
      setSummary(s); setVisits(v.slice(0, 3)); setBookings(b.filter((x) => x.status !== 'cancelled').slice(0, 3));
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message={t('dashboard.loading')} color={C.diner.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const firstName = user?.display_name?.split(' ')[0];

  return (
    <SafeScreen onRefresh={load}>
      <Text style={styles.greeting}>
        {firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.greetingFallback')}
      </Text>
      <Text style={styles.sub}>{t('dashboard.dinerSubtitle')}</Text>

      {summary && (
        <View style={styles.statsRow}>
          <StatBox icon="🍽️" label={t('dashboard.totalVisits')} value={summary.total_visits ?? 0} color={C.diner.primary} />
          <StatBox icon="⭐" label={t('dashboard.avgRating')} value={(summary.avg_rating ?? 0).toFixed(1)} color={C.amber} />
          <StatBox icon="🔁" label={t('dashboard.returnRate')} value={`${Math.round((summary.return_rate ?? 0) * 100)}%`} color={C.green} />
        </View>
      )}

      {bookings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('dashboard.upcomingBookings')}</Text>
          {bookings.map((b) => (
            <View key={b.id} style={styles.card}>
              <Text style={styles.cardIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{b.restaurant_name || t('common.restaurant')}</Text>
                <Text style={styles.cardSub}>
                  {b.date} · {b.time} · {b.party_size === 1 ? t('dashboard.guestsOne') : t('dashboard.guests', { count: b.party_size })}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: b.status === 'confirmed' ? '#dcfce7' : '#fef3c7' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: b.status === 'confirmed' ? '#16a34a' : '#d97706' }}>{b.status}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {visits.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('dashboard.recentVisits')}</Text>
          {visits.map((v) => (
            <View key={v.id} style={styles.card}>
              <Text style={styles.cardIcon}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{v.restaurant_name || t('common.restaurant')}</Text>
                <Text style={styles.cardSub}>{'⭐'.repeat(Math.round(v.overall_rating || 0))} · {v.visit_date}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {bookings.length === 0 && visits.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyText}>{t('dashboard.emptyDining')}</Text>
          <Text style={styles.emptySub}>{t('dashboard.emptyDiningSub')}</Text>
        </View>
      )}
    </SafeScreen>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={{ fontSize: 22, marginBottom: 4 }}>{icon}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLab}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting:    { fontSize: 26, fontWeight: '800', color: C.gray[900], marginBottom: 4 },
  sub:         { fontSize: 14, color: C.gray[500], marginBottom: 20 },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBox:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.gray[100] },
  statVal:     { fontSize: 20, fontWeight: '800' },
  statLab:     { fontSize: 11, color: C.gray[500], marginTop: 2, textAlign: 'center' },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: C.gray[800], marginBottom: 10 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  cardIcon:    { fontSize: 22 },
  cardTitle:   { fontSize: 14, fontWeight: '600', color: C.gray[900] },
  cardSub:     { fontSize: 12, color: C.gray[500], marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  empty:       { alignItems: 'center', marginTop: 40 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { fontSize: 17, fontWeight: '700', color: C.gray[700] },
  emptySub:    { fontSize: 13, color: C.gray[500], marginTop: 6, textAlign: 'center' },
});
