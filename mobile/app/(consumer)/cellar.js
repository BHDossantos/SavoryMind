import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

// Phase 8 — browseable wine / beer / spirits catalog (mobile).
// Mirrors the web /consumer/cellar page. Three-tab layout, free-text
// search + style/region chip filters. Catalog is small enough to fetch
// whole and filter client-side. Tapping "Ask Flavor about this" deep-
// links to the assistant chat with a seed question — same agent
// loop ends up running the pairing tools.

const TABS = [
  { id: 'wine',    label: 'Wine',    icon: '🍷' },
  { id: 'beer',    label: 'Beer',    icon: '🍺' },
  { id: 'spirits', label: 'Spirits', icon: '🥃' },
];

function uniqueValues(items, key) {
  const set = new Set();
  for (const it of items) {
    const v = it[key];
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else if (v) set.add(v);
  }
  return Array.from(set).sort();
}

function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      <Chip label="All" active={value === ''} onPress={() => onChange('')} />
      {options.map((o) => (
        <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CardWine({ w, onAskFlavor }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{w.name}</Text>
        <Text style={styles.cardBadge}>{w.style}</Text>
      </View>
      <Text style={styles.cardFlavour} numberOfLines={2}>{w.flavor_profile}</Text>
      <Text style={styles.cardMeta}>📍 {(w.regions || []).join(' · ')}</Text>
      <Text style={styles.cardMeta}>💰 {w.price_range}</Text>
      <Text style={styles.cardMeta}>🌡️ {w.serving_temp}</Text>
      <TouchableOpacity onPress={() => onAskFlavor(`Tell me about ${w.name} and what to pair with it.`)}>
        <Text style={styles.askLink}>Ask Flavor about this →</Text>
      </TouchableOpacity>
    </View>
  );
}

function CardBeer({ b, onAskFlavor }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{b.name}</Text>
        <Text style={styles.cardBadge}>{b.style}</Text>
      </View>
      <Text style={styles.cardFlavour} numberOfLines={2}>{b.flavour}</Text>
      <Text style={styles.cardMeta}>🍺 {b.brewery}</Text>
      <Text style={styles.cardMeta}>{b.abv}% ABV · {b.serve}</Text>
      <TouchableOpacity onPress={() => onAskFlavor(`What food pairs with a ${b.name} (${b.style})?`)}>
        <Text style={styles.askLink}>Ask Flavor about this →</Text>
      </TouchableOpacity>
    </View>
  );
}

function CardSpirit({ s, onAskFlavor }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{s.name}</Text>
        <Text style={styles.cardBadge}>{s.spirit}</Text>
      </View>
      <Text style={styles.cardFlavour} numberOfLines={2}>{s.flavour}</Text>
      <Text style={styles.cardMeta}>📍 {s.region}</Text>
      <Text style={styles.cardMeta}>{s.abv}% ABV · {s.serve}</Text>
      <TouchableOpacity onPress={() => onAskFlavor(`What food pairs with ${s.name}?`)}>
        <Text style={styles.askLink}>Ask Flavor about this →</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CellarScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [tab, setTab] = useState('wine');
  const [wines, setWines]     = useState([]);
  const [beers, setBeers]     = useState([]);
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterStyle, setFilterStyle]   = useState('');
  const [filterRegion, setFilterRegion] = useState('');

  useEffect(() => {
    Promise.all([api.getWineCatalog(), api.getBeerCatalog(), api.getSpiritsCatalog()])
      .then(([w, b, s]) => {
        setWines(w.wines || []);
        setBeers(b.beers || []);
        setSpirits(s.spirits || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Switching tabs resets filters so a filter that only makes sense
  // for one category doesn't haunt the next (e.g. "Burgundy" wouldn't
  // match anything on the beer tab).
  const switchTab = (id) => {
    setTab(id);
    setFilterStyle('');
    setFilterRegion('');
  };

  const items = tab === 'wine' ? wines : tab === 'beer' ? beers : spirits;
  const styleOptions  = useMemo(() => uniqueValues(items, tab === 'spirits' ? 'spirit' : 'style'), [items, tab]);
  const regionOptions = useMemo(() => uniqueValues(items, tab === 'wine' ? 'regions' : 'region'), [items, tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !JSON.stringify(it).toLowerCase().includes(q)) return false;
      if (filterStyle) {
        const v = it.style || it.spirit;
        if (v !== filterStyle) return false;
      }
      if (filterRegion) {
        const regs = Array.isArray(it.regions) ? it.regions : [it.region];
        if (!regs.some((r) => r === filterRegion)) return false;
      }
      return true;
    });
  }, [items, search, filterStyle, filterRegion]);

  // Deep-link into the assistant chat with the seed question routed
  // via the chat's existing send() flow on mount. We pass it as a
  // query param + let the chat screen pick it up (added below).
  const askFlavor = (question) => {
    router.push({ pathname: '/(consumer)/assistant', params: { q: question } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.consumer.primary} />
          <Text style={styles.loadingText}>Loading the cellar…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Cellar</Text>
        <Text style={styles.subtitle}>Every wine, beer, and spirit Flavor can pair from.</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((tab2) => (
            <TouchableOpacity
              key={tab2.id}
              style={[styles.tab, tab === tab2.id && styles.tabActive]}
              onPress={() => switchTab(tab2.id)}
            >
              <Text style={[styles.tabText, tab === tab2.id && styles.tabTextActive]}>
                {tab2.icon} {tab2.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${tab}s…`}
          placeholderTextColor={C.gray[400]}
        />

        {styleOptions.length > 0 && (
          <>
            <Text style={styles.filterLabel}>Style</Text>
            <ChipRow options={styleOptions} value={filterStyle} onChange={setFilterStyle} />
          </>
        )}

        {regionOptions.length > 0 && (
          <>
            <Text style={styles.filterLabel}>Region</Text>
            <ChipRow options={regionOptions.slice(0, 30)} value={filterRegion} onChange={setFilterRegion} />
          </>
        )}

        <Text style={styles.resultsCount}>{filtered.length} of {items.length} {tab}s</Text>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyText}>Nothing matches these filters yet.</Text>
          </View>
        ) : (
          <View>
            {filtered.map((it, i) =>
              tab === 'wine'    ? <CardWine    key={it.slug || i} w={it} onAskFlavor={askFlavor} /> :
              tab === 'beer'    ? <CardBeer    key={it.name || i} b={it} onAskFlavor={askFlavor} /> :
                                  <CardSpirit  key={it.name || i} s={it} onAskFlavor={askFlavor} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText:    { marginTop: 12, color: C.gray[500], fontSize: 13 },
  title:          { fontSize: 24, fontWeight: '800', color: C.gray[900], marginBottom: 4 },
  subtitle:       { fontSize: 13, color: C.gray[500], marginBottom: 16 },

  tabs:           { flexDirection: 'row', backgroundColor: C.consumer.light, padding: 4, borderRadius: 12, marginBottom: 16 },
  tab:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  tabActive:      { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabText:        { fontSize: 13, fontWeight: '600', color: C.gray[500] },
  tabTextActive:  { color: C.consumer.primary, fontWeight: '700' },

  search:         { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.gray[900], backgroundColor: '#fff', marginBottom: 12 },

  filterLabel:    { fontSize: 11, fontWeight: '700', color: C.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 6 },
  chipsRow:       { gap: 6, paddingRight: 16 },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.gray[100], marginRight: 6 },
  chipActive:     { backgroundColor: C.consumer.primary },
  chipText:       { fontSize: 11, fontWeight: '600', color: C.gray[600] },
  chipTextActive: { color: '#fff' },

  resultsCount:   { fontSize: 11, color: C.gray[400], marginTop: 12, marginBottom: 8 },

  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  cardName:       { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1 },
  cardBadge:      { fontSize: 11, fontWeight: '700', color: C.consumer.primary, backgroundColor: C.consumer.light, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  cardFlavour:    { fontSize: 12, color: C.gray[500], lineHeight: 17, marginBottom: 6 },
  cardMeta:       { fontSize: 11, color: C.gray[500], marginTop: 2 },
  askLink:        { fontSize: 12, color: C.consumer.primary, fontWeight: '700', marginTop: 8 },

  empty:          { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:      { fontSize: 32, marginBottom: 8 },
  emptyText:      { fontSize: 13, color: C.gray[500] },
});
