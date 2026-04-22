import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const CAT_EMOJI = { Mains: '🍽️', Starters: '🥗', Desserts: '🍰', Drinks: '🍹' };

function SectionHeader({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MetricRow({ label, value, accent }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = async () => {
    try { setData(await api.getReportsSummary()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const handleExport = async () => {
    if (!data) return;
    const lines = [
      'Category,Items,Avg Price,Avg Margin,Total Orders,Total Revenue,Avg Rating',
      ...(data.category_breakdown || []).map(c =>
        `${c.category},${c.item_count},$${c.avg_price.toFixed(2)},${c.avg_margin.toFixed(1)}%,${c.total_orders},$${c.total_revenue.toFixed(0)},${c.avg_rating.toFixed(1)}`
      ),
    ].join('\n');
    await Share.share({ message: lines, title: 'SavoryMind Report' });
  };

  if (loading) return <LoadingSpinner message="Building report..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const cats    = data.category_breakdown || [];
  const topRev  = data.top_5_by_revenue || [];
  const botMarg = data.bottom_5_by_margin || [];
  const sent    = data.sentiment_trend || [];

  const totalRevenue = cats.reduce((s, c) => s + c.total_revenue, 0);
  const totalOrders  = cats.reduce((s, c) => s + c.total_orders, 0);
  const avgMargin    = cats.length ? (cats.reduce((s, c) => s + c.avg_margin, 0) / cats.length).toFixed(1) : '—';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Reports</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Text style={styles.exportText}>↑ Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Top-line summary */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
            { label: 'Total Orders', value: totalOrders.toLocaleString() },
            { label: 'Avg Margin', value: `${avgMargin}%` },
          ].map(m => (
            <View key={m.label} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{m.value}</Text>
              <Text style={styles.summaryLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Category breakdown */}
        <SectionHeader title="Category Breakdown" />
        {cats.map(c => (
          <View key={c.category} style={styles.catCard}>
            <View style={styles.catHeader}>
              <Text style={styles.catName}>{CAT_EMOJI[c.category] || '📊'} {c.category}</Text>
              <Text style={styles.catRevenue}>${c.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
            <View style={styles.catStats}>
              <MetricRow label="Items" value={c.item_count} />
              <MetricRow label="Avg Price" value={`$${c.avg_price.toFixed(2)}`} />
              <MetricRow label="Avg Margin" value={`${c.avg_margin.toFixed(1)}%`} accent={c.avg_margin >= 60 ? C.green : c.avg_margin >= 40 ? C.amber : C.red} />
              <MetricRow label="Orders" value={c.total_orders} />
              <MetricRow label="Avg Rating" value={`${c.avg_rating.toFixed(1)} ⭐`} />
            </View>
          </View>
        ))}

        {/* Top 5 by revenue */}
        {topRev.length > 0 && (
          <>
            <SectionHeader title="Top 5 by Revenue" />
            {topRev.map((item, i) => (
              <View key={i} style={styles.rankCard}>
                <View style={styles.rankNum}><Text style={styles.rankNumText}>#{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName}>{item.name}</Text>
                  <Text style={styles.rankCat}>{item.category}</Text>
                </View>
                <Text style={styles.rankValue}>${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
            ))}
          </>
        )}

        {/* Bottom 5 by margin */}
        {botMarg.length > 0 && (
          <>
            <SectionHeader title="Lowest Margins — Needs Attention" />
            {botMarg.map((item, i) => (
              <View key={i} style={[styles.rankCard, { borderLeftWidth: 3, borderLeftColor: C.red }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName}>{item.name}</Text>
                  <Text style={styles.rankCat}>{item.category}</Text>
                </View>
                <Text style={[styles.rankValue, { color: C.red }]}>{item.value.toFixed(1)}%</Text>
              </View>
            ))}
          </>
        )}

        {/* Sentiment trend */}
        {sent.length > 0 && (
          <>
            <SectionHeader title="Review Sentiment" />
            {sent.map((m, i) => {
              const total = m.total || 1;
              return (
                <View key={i} style={styles.sentCard}>
                  <Text style={styles.sentMonth}>{m.month}</Text>
                  <View style={styles.sentBars}>
                    <View style={[styles.sentBar, { flex: m.positive / total, backgroundColor: C.green }]} />
                    <View style={[styles.sentBar, { flex: m.neutral / total, backgroundColor: C.gray[300] }]} />
                    <View style={[styles.sentBar, { flex: m.negative / total, backgroundColor: C.red }]} />
                  </View>
                  <View style={styles.sentLegend}>
                    <Text style={[styles.sentLegText, { color: C.green }]}>✓ {m.positive}</Text>
                    <Text style={[styles.sentLegText, { color: C.gray[400] }]}>– {m.neutral}</Text>
                    <Text style={[styles.sentLegText, { color: C.red }]}>✕ {m.negative}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  exportBtn:    { backgroundColor: C.restaurant.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  exportText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  summaryRow:   { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.gray[100] },
  summaryValue: { fontSize: 18, fontWeight: '800', color: C.restaurant.primary },
  summaryLabel: { fontSize: 10, color: C.gray[500], marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10, marginTop: 6 },
  catCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  catHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catName:      { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  catRevenue:   { fontSize: 16, fontWeight: '800', color: C.restaurant.primary },
  catStats:     { gap: 4 },
  metricRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  metricLabel:  { fontSize: 12, color: C.gray[500] },
  metricValue:  { fontSize: 13, fontWeight: '600', color: C.gray[800] },
  rankCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.gray[100] },
  rankNum:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.restaurant.light, alignItems: 'center', justifyContent: 'center' },
  rankNumText:  { fontSize: 11, fontWeight: '800', color: C.restaurant.text },
  rankName:     { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  rankCat:      { fontSize: 11, color: C.gray[400] },
  rankValue:    { fontSize: 15, fontWeight: '700', color: C.green },
  sentCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  sentMonth:    { fontSize: 13, fontWeight: '700', color: C.gray[800], marginBottom: 8 },
  sentBars:     { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1, marginBottom: 6 },
  sentBar:      { borderRadius: 5 },
  sentLegend:   { flexDirection: 'row', gap: 16 },
  sentLegText:  { fontSize: 12, fontWeight: '600' },
});
