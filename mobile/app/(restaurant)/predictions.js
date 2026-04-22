import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const TREND_ICON = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR = { up: C.green, down: C.red, stable: C.gray[400] };
const CAT_EMOJI = { Mains: '🍽️', Starters: '🥗', Desserts: '🍰', Drinks: '🍹' };

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? C.green : pct >= 75 ? C.amber : C.red;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.confText, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function PredictionsScreen() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try { setData(await api.getPredictions()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message="Calculating forecast..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={() => load()} />;

  const totalOrders  = data.top_items.reduce((s, i) => s + i.predicted_orders, 0);
  const totalRevenue = data.top_items.reduce((s, i) => s + i.predicted_revenue, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Sales Forecast</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Window banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🔮</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{data.window_label}</Text>
            <Text style={styles.bannerSub}>{data.day_label}</Text>
          </View>
        </View>

        {/* Summary totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalValue}>{totalOrders}</Text>
            <Text style={styles.totalLabel}>Predicted Orders</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalValue}>${totalRevenue.toFixed(0)}</Text>
            <Text style={styles.totalLabel}>Predicted Revenue</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Top Items This Window</Text>
        {data.top_items.map((item, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardRank}>
              <Text style={styles.rankText}>#{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.itemName}>{CAT_EMOJI[item.category] || '🍽️'} {item.name}</Text>
                <Text style={[styles.trend, { color: TREND_COLOR[item.trend] || C.gray[400] }]}>
                  {TREND_ICON[item.trend]} {item.trend}
                </Text>
              </View>
              <Text style={styles.itemMeta}>{item.predicted_orders} orders · ${item.predicted_revenue.toFixed(0)} revenue · {item.category}</Text>
              <Text style={styles.confLabel}>Confidence</Text>
              <ConfidenceBar value={item.confidence} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  refreshBtn:   { padding: 8 },
  refreshText:  { fontSize: 14, color: C.restaurant.primary, fontWeight: '600' },
  banner:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.restaurant.light, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.restaurant.border },
  bannerIcon:   { fontSize: 30 },
  bannerTitle:  { fontSize: 15, fontWeight: '700', color: C.restaurant.text },
  bannerSub:    { fontSize: 12, color: C.restaurant.muted, marginTop: 3 },
  totalsRow:    { flexDirection: 'row', gap: 12, marginBottom: 20 },
  totalCard:    { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.gray[100] },
  totalValue:   { fontSize: 24, fontWeight: '800', color: C.restaurant.primary },
  totalLabel:   { fontSize: 11, color: C.gray[500], marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: C.gray[100] },
  cardRank:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.restaurant.light, alignItems: 'center', justifyContent: 'center' },
  rankText:     { fontSize: 12, fontWeight: '800', color: C.restaurant.text },
  itemName:     { fontSize: 14, fontWeight: '700', color: C.gray[900], flex: 1, marginRight: 8 },
  itemMeta:     { fontSize: 12, color: C.gray[500], marginTop: 2 },
  trend:        { fontSize: 12, fontWeight: '600' },
  confLabel:    { fontSize: 11, color: C.gray[400], marginTop: 6 },
  barTrack:     { flex: 1, height: 6, backgroundColor: C.gray[100], borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },
  confText:     { fontSize: 12, fontWeight: '700', width: 34 },
});
