import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

// Kitchen Display System: live tickets routed to stations, longest-waiting
// first. Each line bumps new → preparing → ready → served; served clears it.
const NEXT = { new: 'preparing', preparing: 'ready', ready: 'served' };
const STATUS_COLOR = { new: C.gray[400], preparing: C.amber, ready: C.green };

export default function KitchenDisplayScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState({ stations: [], total_active: 0 });
  const [station, setStation] = useState(null);     // null = all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async (st) => {
    try {
      setData(await api.getKitchen(st ?? station));
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [station]);

  // Poll every 12s while focused so the line sees new tickets without tapping.
  useFocusEffect(useCallback(() => {
    load();
    timer.current = setInterval(() => load(), 12000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]));

  const bump = async (item) => {
    const next = NEXT[item.status];
    if (!next) return;
    try { await api.setOrderItemStatus(item.id, next); await load(); }
    catch (e) { setError(e.message); }
  };

  // All station names seen, for the filter row.
  const allStations = data.stations.map((s) => s.station);
  const shown = station ? data.stations.filter((s) => s.station === station) : data.stations;

  if (loading) return <SafeScreen><ActivityIndicator style={{ marginTop: 40 }} color={C.restaurant.primary} /></SafeScreen>;
  if (error) return <SafeScreen><ErrorMessage message={error} onRetry={() => load()} /></SafeScreen>;

  return (
    <SafeScreen onRefresh={() => load()}>
      <View style={s.header}>
        <Text style={s.title}>{t('orders.kitchenTitle')}</Text>
        <Text style={s.count}>{data.total_active} {t('orders.active')}</Text>
      </View>

      {/* Station filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t('orders.allStations')} on={station === null} onPress={() => setStation(null)} />
        {allStations.map((st) => (
          <Chip key={st} label={st} on={station === st} onPress={() => setStation(st)} />
        ))}
      </ScrollView>

      {data.total_active === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>✅</Text>
          <Text style={s.emptyText}>{t('orders.kitchenClear')}</Text>
        </View>
      )}

      {shown.map((grp) => (
        <View key={grp.station} style={{ marginBottom: 18 }}>
          <Text style={s.stationName}>{grp.station} · {grp.items.length}</Text>
          {grp.items.map((it) => (
            <View key={it.id} style={[s.ticket, { borderLeftColor: it.age_minutes >= 15 ? C.red : it.age_minutes >= 8 ? C.amber : C.restaurant.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.ticketName}>{it.quantity}× {it.name}</Text>
                <Text style={s.ticketMeta}>
                  {t('orders.table')} {it.table_number} · {it.age_minutes}{t('orders.minShort')}
                  {it.notes ? ` · ${it.notes}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[s.bump, { backgroundColor: STATUS_COLOR[it.status] || C.gray[400] }]}
                onPress={() => bump(it)}
                testID={`bump-${it.id}`}
              >
                <Text style={s.bumpText}>{t(`orders.itemStatus.${it.status}`)}</Text>
                <Text style={s.bumpNext}>→ {t(`orders.itemStatus.${NEXT[it.status]}`)}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
    </SafeScreen>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[c.chip, on && c.chipOn]}>
      <Text style={[c.chipText, on && c.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  chipOn:    { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  chipText:  { fontSize: 13, fontWeight: '600', color: C.gray[600] },
  chipTextOn:{ color: '#fff' },
});

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  title:      { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  count:      { fontSize: 14, fontWeight: '700', color: C.restaurant.primary },
  filterRow:  { marginBottom: 16, flexGrow: 0 },
  empty:      { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText:  { fontSize: 15, color: C.gray[500] },
  stationName:{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: C.gray[700], marginBottom: 8 },
  ticket:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.gray[100], borderLeftWidth: 5, padding: 14, marginBottom: 8 },
  ticketName: { fontSize: 16, fontWeight: '700', color: C.gray[900] },
  ticketMeta: { fontSize: 12, color: C.gray[500], marginTop: 3 },
  bump:       { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 96 },
  bumpText:   { color: '#fff', fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  bumpNext:   { color: '#fff', fontSize: 10, opacity: 0.85, marginTop: 2 },
});
