import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const TABS = ['Menu Trends', 'Global Trends'];

export default function Trends() {
  const [data, setData]         = useState(null);
  const [tab, setTab]           = useState('Menu Trends');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setData(await api.getMenuTrends());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message="Analysing trends…" color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <SafeScreen onRefresh={load} refreshing={refreshing}>
      <Text style={s.title}>Trend Alerts</Text>
      <Text style={s.subtitle}>
        {data.total_items} items · {data.total_reviews} reviews analysed
      </Text>

      <View style={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Menu Trends' && (
        <View>
          <Section title="🚀 Rising Stars" items={data.rising_stars} emptyMsg="Add more items & reviews to unlock this" />
          <Section title="💎 Hidden Gems" items={data.hidden_gems}  emptyMsg="No high-margin underperformers found" />
          <Section title="⚠️ At Risk"     items={data.at_risk}      emptyMsg="All items have healthy sentiment" />
        </View>
      )}

      {tab === 'Global Trends' && (
        <View>
          <Text style={s.sectionTitle}>What's hot in dining right now</Text>
          {data.global_trends.map((g, i) => (
            <View key={i} style={s.globalCard}>
              <Text style={s.globalTrend}>{g.trend}</Text>
              <Text style={s.globalInsight}>{g.insight}</Text>
            </View>
          ))}
        </View>
      )}
    </SafeScreen>
  );
}

function Section({ title, items, emptyMsg }) {
  if (!items || items.length === 0) {
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.emptyMsg}>{emptyMsg}</Text>
      </View>
    );
  }
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={s.itemCard}>
          <View style={s.itemHeader}>
            <Text style={s.itemName}>{item.name}</Text>
            <Text style={s.itemPrice}>${item.price}</Text>
          </View>
          <Text style={s.itemMeta}>
            {item.category} · {item.orders} orders · {item.margin}% margin · {item.reviews} reviews
          </Text>
          <Text style={s.itemInsight}>{item.insight}</Text>
        </View>
      ))}
    </View>
  );
}

const ACC = C.restaurant.primary;

const s = StyleSheet.create({
  title:        { fontSize: 24, fontWeight: '800', color: C.gray[900], marginBottom: 2 },
  subtitle:     { fontSize: 13, color: C.gray[500], marginBottom: 16 },
  tabRow:       { flexDirection: 'row', backgroundColor: C.gray[100], borderRadius: 10, padding: 3, marginBottom: 20 },
  tabBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabText:      { fontSize: 13, fontWeight: '600', color: C.gray[500] },
  tabTextActive:{ color: C.gray[900] },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.gray[900], marginBottom: 10 },
  emptyMsg:     { fontSize: 13, color: C.gray[400], fontStyle: 'italic' },
  itemCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  itemHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName:     { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1 },
  itemPrice:    { fontSize: 14, fontWeight: '700', color: ACC },
  itemMeta:     { fontSize: 12, color: C.gray[500], marginBottom: 8 },
  itemInsight:  { fontSize: 13, color: C.gray[700], fontStyle: 'italic' },
  globalCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.gray[100] },
  globalTrend:  { fontSize: 15, fontWeight: '700', color: C.gray[900], marginBottom: 6 },
  globalInsight:{ fontSize: 13, color: C.gray[600], lineHeight: 19 },
});
