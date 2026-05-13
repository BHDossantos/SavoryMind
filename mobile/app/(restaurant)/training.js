import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const PRIORITY_STYLE = {
  high:   { bg: '#fef2f2', border: '#fecaca', text: C.red,    label: '🔴 High' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: C.amber,  label: '🟡 Medium' },
  low:    { bg: '#f0fdf4', border: '#bbf7d0', text: C.green,  label: '🟢 Low' },
};

const TYPE_LABELS = {
  waste_reduction: '🗑️ Waste Reduction',
  speed_coaching:  '⏱️ Speed Coaching',
  punctuality:     '🕐 Punctuality',
  performance:     '📈 Performance',
  quality:         '⭐ Quality',
};

export default function TrainingScreen() {
  const { t } = useTranslation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    try { setData(await api.getTrainingRecommendations()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const toggle = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }));

  if (loading) return <LoadingSpinner message="Loading training insights..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const recs = data?.recommendations || [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t('screens.training.title')}</Text>
          <Text style={styles.sub}>{recs.length} recommendations · {data?.high_priority ?? 0} high priority</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {recs.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🎓</Text>
            <Text style={styles.emptyTitle}>All good!</Text>
            <Text style={styles.emptySub}>No training recommendations right now. Keep up the great work.</Text>
          </View>
        )}

        {recs.map((rec, i) => {
          const p = PRIORITY_STYLE[rec.priority] || PRIORITY_STYLE.low;
          const open = expanded[i];
          return (
            <TouchableOpacity key={i} style={[styles.card, { borderColor: p.border, backgroundColor: '#fff' }]} onPress={() => toggle(i)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <View style={[styles.priorityDot, { backgroundColor: p.bg, borderColor: p.border }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: p.text }}>{p.label}</Text>
                </View>
                <Text style={styles.typeLabel}>{TYPE_LABELS[rec.type] || rec.type}</Text>
              </View>

              <Text style={styles.cardTitle}>{rec.title}</Text>
              <Text style={styles.staffName}>👤 {rec.staff}</Text>

              {open && (
                <>
                  <Text style={styles.detail}>{rec.detail}</Text>
                  {rec.actions?.length > 0 && (
                    <View style={styles.actionsBox}>
                      <Text style={styles.actionsTitle}>Action Steps</Text>
                      {rec.actions.map((a, j) => (
                        <View key={j} style={styles.actionRow}>
                          <Text style={styles.actionNum}>{j + 1}.</Text>
                          <Text style={styles.actionText}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              <Text style={[styles.chevron, open && styles.chevronOpen]}>{open ? '▲ Less' : '▼ More'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:          { fontSize: 12, color: C.gray[500], marginTop: 2 },
  refreshBtn:   { padding: 8 },
  refreshText:  { fontSize: 22, color: C.restaurant.primary, fontWeight: '600' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priorityDot:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  typeLabel:    { fontSize: 12, color: C.gray[500] },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: C.gray[900], marginBottom: 3 },
  staffName:    { fontSize: 13, color: C.gray[600] },
  detail:       { fontSize: 13, color: C.gray[700], lineHeight: 19, marginTop: 10 },
  actionsBox:   { backgroundColor: C.gray[50], borderRadius: 10, padding: 12, marginTop: 10 },
  actionsTitle: { fontSize: 12, fontWeight: '700', color: C.gray[700], marginBottom: 8 },
  actionRow:    { flexDirection: 'row', gap: 6, marginBottom: 6 },
  actionNum:    { fontSize: 13, fontWeight: '700', color: C.restaurant.primary, width: 16 },
  actionText:   { flex: 1, fontSize: 13, color: C.gray[700], lineHeight: 18 },
  chevron:      { fontSize: 11, color: C.gray[400], marginTop: 10, textAlign: 'right' },
  chevronOpen:  { color: C.restaurant.primary },
  emptyBox:     { alignItems: 'center', marginTop: 60 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: C.gray[800] },
  emptySub:     { fontSize: 14, color: C.gray[400], textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
