import { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

export default function Marketing() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setData(await api.getMarketingInsights());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message="Loading insights…" color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const ov = data.overview;

  return (
    <SafeScreen onRefresh={load} refreshing={refreshing}>
      <Text style={s.title}>Marketing</Text>
      <Text style={s.subtitle}>Guest acquisition & retention</Text>

      {/* Overview metrics */}
      <View style={s.metricsGrid}>
        <MetricTile label="Total Guests"    value={ov.total_guests} />
        <MetricTile label="VIP Guests"      value={ov.vip_guests} />
        <MetricTile label="Retention"       value={ov.retention_rate} />
        <MetricTile label="Avg Spend"       value={ov.avg_spend} />
        <MetricTile label="Bookings"        value={ov.total_bookings} />
        <MetricTile label="Fill Rate"       value={ov.booking_fill_rate} />
        <MetricTile label="Cancel Rate"     value={ov.cancel_rate} accent="#ef4444" />
      </View>

      {/* Action items */}
      {data.actions && data.actions.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Action Items</Text>
          {data.actions.map((a, i) => (
            <View key={i} style={s.actionCard}>
              <View style={s.actionHeader}>
                <Text style={s.actionIcon}>{a.icon}</Text>
                <View style={s.actionMeta}>
                  <Text style={s.actionTitle}>{a.title}</Text>
                  <View style={[s.priorityBadge, { backgroundColor: PRIORITY_COLOR[a.priority] + '20' }]}>
                    <Text style={[s.priorityText, { color: PRIORITY_COLOR[a.priority] }]}>
                      {a.priority}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={s.actionDetail}>{a.detail}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tips */}
      {data.tips && data.tips.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Marketing Tips</Text>
          {data.tips.map((t, i) => (
            <View key={i} style={s.tipCard}>
              <Text style={s.tipIcon}>{t.icon}</Text>
              <Text style={s.tipText}>{t.tip}</Text>
            </View>
          ))}
        </View>
      )}
    </SafeScreen>
  );
}

function MetricTile({ label, value, accent }) {
  return (
    <View style={s.tile}>
      <Text style={[s.tileValue, accent && { color: accent }]}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const ACC = C.restaurant.primary;

const s = StyleSheet.create({
  title:        { fontSize: 24, fontWeight: '800', color: C.gray[900], marginBottom: 2 },
  subtitle:     { fontSize: 13, color: C.gray[500], marginBottom: 16 },
  metricsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  tile:         { width: '30%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.gray[100], alignItems: 'center' },
  tileValue:    { fontSize: 18, fontWeight: '800', color: ACC, marginBottom: 4 },
  tileLabel:    { fontSize: 10, fontWeight: '600', color: C.gray[500], textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.gray[900], marginBottom: 12 },
  actionCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  actionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  actionIcon:   { fontSize: 24 },
  actionMeta:   { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionTitle:  { fontSize: 14, fontWeight: '700', color: C.gray[900], flex: 1 },
  priorityBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actionDetail: { fontSize: 13, color: C.gray[600], lineHeight: 19 },
  tipCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  tipIcon:      { fontSize: 22 },
  tipText:      { fontSize: 13, color: C.gray[700], flex: 1, lineHeight: 19 },
});
