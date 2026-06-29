import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const TYPE_CONFIG = {
  price_increase: { icon: '💰', label: 'Price Increase', color: C.green },
  promotion:      { icon: '📣', label: 'Promotion',      color: '#3b82f6' },
  quality_review: { icon: '⚠️', label: 'Quality Review', color: C.red },
  star_item:      { icon: '⭐', label: 'Star Item',       color: C.amber },
};

const PRIORITY_COLOR = { high: C.red, medium: C.amber, low: C.green };

export default function RecommendationsScreen() {
  const { t } = useTranslation();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    try {
      const data = await api.getRecommendations();
      setRecs(data); setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = recs.filter((r) => filter === 'all' || r.priority === filter);
  const totalGain = recs.reduce((s, r) => s + (r.potential_monthly_gain || 0), 0);

  if (loading) return <LoadingSpinner message="Loading insights..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('screens.recommendations.title')}</Text>
        {totalGain > 0 && <Text style={styles.gain}>+${totalGain.toLocaleString()}/mo potential</Text>}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Summary row */}
        <View style={styles.summaryRow}>
          {['high', 'medium', 'low'].map((p) => {
            const count = recs.filter((r) => r.priority === p).length;
            return (
              <View key={p} style={[styles.summaryBox, { borderColor: PRIORITY_COLOR[p] }]}>
                <Text style={[styles.summaryNum, { color: PRIORITY_COLOR[p] }]}>{count}</Text>
                <Text style={styles.summaryLab}>{p}</Text>
              </View>
            );
          })}
        </View>

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {['all', 'high', 'medium', 'low'].map((f) => (
            <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.map((rec, i) => {
          const cfg = TYPE_CONFIG[rec.recommendation_type] || { icon: '💡', label: rec.recommendation_type, color: C.gray[500] };
          return (
            <View key={i} style={[styles.card, { borderLeftColor: PRIORITY_COLOR[rec.priority] || C.gray[300] }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.recIcon}>{cfg.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{rec.item_name}</Text>
                  <Text style={[styles.recType, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {rec.potential_monthly_gain > 0 && (
                  <Text style={styles.gain2}>+${rec.potential_monthly_gain.toLocaleString()}</Text>
                )}
              </View>
              <Text style={styles.message}>{rec.message}</Text>
              <View style={styles.meta}>
                <Text style={[styles.priority, { color: PRIORITY_COLOR[rec.priority] }]}>
                  {rec.priority?.toUpperCase()} priority
                </Text>
                <Text style={styles.cat}>{rec.category}</Text>
              </View>
            </View>
          );
        })}
        {filtered.length === 0 && <Text style={styles.empty}>No recommendations for this filter.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  gain:         { fontSize: 13, fontWeight: '600', color: C.green },
  summaryRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryBox:   { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1.5 },
  summaryNum:   { fontSize: 22, fontWeight: '800' },
  summaryLab:   { fontSize: 11, color: C.gray[500], marginTop: 2, textTransform: 'capitalize' },
  filterBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], marginRight: 8, backgroundColor: '#fff' },
  filterBtnActive:{ backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  filterText:   { fontSize: 13, color: C.gray[600], fontWeight: '500', textTransform: 'capitalize' },
  filterTextActive:{ color: '#fff', fontWeight: '700' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: C.gray[100] },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  recIcon:      { fontSize: 22 },
  itemName:     { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  recType:      { fontSize: 12, fontWeight: '600', marginTop: 1 },
  gain2:        { fontSize: 13, fontWeight: '700', color: C.green },
  message:      { fontSize: 13, color: C.gray[600], lineHeight: 19 },
  meta:         { flexDirection: 'row', gap: 10, marginTop: 8 },
  priority:     { fontSize: 11, fontWeight: '700' },
  cat:          { fontSize: 11, color: C.gray[400] },
  empty:        { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
});
