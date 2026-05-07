import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { C } from '../../constants/colors';
import { api } from '../../services/api';


// Mirror frontend/src/pages/consumer/beverages.js — wine + beer + spirits
// in one tabbed screen. Backend returns the same shape across all three:
//   { dish, type, pairings: [{ name, ...type-specific fields..., confidence }] }
// or, for wine via createWinePairing:
//   { id, dish_name, recommendations: [{ name, grape, region, ... }], created_at }
// We normalize both shapes into a single `pairings` array for display.
const TABS = [
  { id: 'wine',    label: 'Wine',    icon: '🍷' },
  { id: 'beer',    label: 'Beer',    icon: '🍺' },
  { id: 'spirits', label: 'Spirits', icon: '🥃' },
];

const SUGGESTIONS = ['Beef Steak', 'Grilled Salmon', 'Spicy Thai Curry', 'Margherita Pizza', 'Chocolate Cake'];


function confidenceColor(c) {
  if (c >= 0.8) return '#16a34a';
  if (c >= 0.6) return '#d97706';
  return C.gray[500];
}


export default function PairingsScreen() {
  const [tab, setTab]         = useState('wine');
  const [dish, setDish]       = useState('');
  const [results, setResults] = useState(null);   // raw response from API
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Reset everything when the user switches tabs.
  useFocusEffect(useCallback(() => {
    return () => { setResults(null); setError(null); };
  }, []));

  const handleSearch = async () => {
    if (!dish.trim()) { setError('Enter a dish name.'); return; }
    setLoading(true); setError(null); setResults(null);
    try {
      let data;
      if (tab === 'wine') {
        // Wine endpoint takes dish_name; mood + occasion are stored on
        // the WinePairing row but not strictly required by the schema.
        data = await api.createWinePairing({ dish_name: dish.trim() });
      } else if (tab === 'beer') {
        data = await api.getBeerPairing(dish.trim());
      } else {
        data = await api.getSpiritsPairing(dish.trim());
      }
      setResults(data);
    } catch (e) {
      setError(e.message || 'Could not get pairing.');
    } finally {
      setLoading(false);
    }
  };

  // Normalize response shape: wine has `recommendations`, beer/spirits have
  // `pairings`. Display layer treats them the same.
  const items = results?.pairings || results?.recommendations || [];
  const dishLabel = results?.dish || results?.dish_name || dish;

  const tabIcon = TABS.find((t) => t.id === tab)?.icon || '🥂';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🥂 Beverage Pairing</Text>
        <Text style={styles.subtitle}>AI-matched wine, beer & spirits for any dish</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tab selector */}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => { setTab(t.id); setResults(null); setError(null); }}
              testID={`tab-${t.id}`}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
                {t.icon} {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={dish}
            onChangeText={(v) => { setDish(v); setError(null); }}
            placeholder={`Dish to pair with ${tab}...`}
            placeholderTextColor={C.gray[400]}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            testID="dish-input"
          />
          <TouchableOpacity
            style={[styles.searchBtn, (!dish.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleSearch}
            disabled={loading || !dish.trim()}
            testID="search-btn"
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Pair</Text>}
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Results */}
        {items.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.resultsHeader}>
              Top {tab} pairings for "{dishLabel}"
            </Text>
            {items.map((p, i) => (
              <View key={i} style={[styles.pairingCard, i === 0 && styles.pairingCardTop]} testID={`pairing-card-${i}`}>
                {i === 0 && <Text style={styles.topMatchBadge}>⭐ Top Match</Text>}
                <Text style={styles.pairingEmoji}>{tabIcon}</Text>
                <Text style={styles.pairingName}>{p.name}</Text>

                {tab === 'wine' && (
                  <>
                    {(p.grape || p.region) && (
                      <Text style={styles.pairingMeta}>
                        {[p.grape, p.region].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {p.style && <Text style={styles.pairingStyle}>{p.style}</Text>}
                    {(p.rationale || p.pairing_notes) && (
                      <Text style={styles.pairingRationale}>{p.rationale || p.pairing_notes}</Text>
                    )}
                    {p.serving_temp && <Text style={styles.pairingFooter}>🌡️ {p.serving_temp}</Text>}
                  </>
                )}

                {tab === 'beer' && (
                  <>
                    {(p.style || p.abv) && (
                      <Text style={styles.pairingMeta}>
                        {[p.style, p.abv && `${p.abv}% ABV`].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {p.flavour && <Text style={styles.pairingStyle}>{p.flavour}</Text>}
                    {p.rationale && <Text style={styles.pairingRationale}>{p.rationale}</Text>}
                    {p.serve && <Text style={styles.pairingFooter}>🍺 {p.serve}</Text>}
                  </>
                )}

                {tab === 'spirits' && (
                  <>
                    {(p.spirit || p.region) && (
                      <Text style={styles.pairingMeta}>
                        {[p.spirit, p.region].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {p.flavour && <Text style={styles.pairingStyle}>{p.flavour}</Text>}
                    {p.rationale && <Text style={styles.pairingRationale}>{p.rationale}</Text>}
                    {p.serve && <Text style={styles.pairingFooter}>🥃 {p.serve}</Text>}
                  </>
                )}

                {p.confidence != null && (
                  <View style={styles.confidenceRow}>
                    <View style={styles.confidenceBar}>
                      <View style={[
                        styles.confidenceFill,
                        { width: `${Math.round(p.confidence * 100)}%`, backgroundColor: confidenceColor(p.confidence) },
                      ]} />
                    </View>
                    <Text style={[styles.confidenceText, { color: confidenceColor(p.confidence) }]}>
                      {Math.round(p.confidence * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Inspiration chips when no result */}
        {!results && !loading && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.suggestionsLabel}>Try these:</Text>
            <View style={styles.chipRow}>
              {SUGGESTIONS.map((d) => (
                <TouchableOpacity key={d} style={styles.suggestionChip} onPress={() => setDish(d)}>
                  <Text style={styles.suggestionChipText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  topBar:        { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  subtitle:      { fontSize: 13, color: C.gray[500], marginTop: 2 },

  tabs:          { flexDirection: 'row', backgroundColor: C.consumer.light, padding: 4, borderRadius: 12, marginBottom: 16 },
  tab:           { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  tabActive:     { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabText:       { fontSize: 13, fontWeight: '600', color: C.gray[500] },
  tabTextActive: { color: C.consumer.primary, fontWeight: '700' },

  inputRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:         { flex: 1, borderWidth: 1, borderColor: C.consumer.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.gray[900], backgroundColor: '#fff' },
  searchBtn:     { backgroundColor: C.consumer.primary, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, minWidth: 80 },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  error:         { color: C.red, fontSize: 13, marginBottom: 8 },

  resultsHeader: { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 12 },

  pairingCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.consumer.border },
  pairingCardTop: { borderColor: C.consumer.primary, borderWidth: 2 },
  topMatchBadge:  { fontSize: 11, fontWeight: '700', color: C.consumer.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  pairingEmoji:   { fontSize: 28 },
  pairingName:    { fontSize: 16, fontWeight: '700', color: C.gray[900], marginTop: 4 },
  pairingMeta:    { fontSize: 12, color: C.gray[500], marginTop: 2 },
  pairingStyle:   { fontSize: 12, color: C.consumer.primary, marginTop: 2, fontStyle: 'italic' },
  pairingRationale:{ fontSize: 13, color: C.gray[700], marginTop: 8, lineHeight: 18 },
  pairingFooter:  { fontSize: 11, color: C.gray[400], marginTop: 6 },
  confidenceRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  confidenceBar:  { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.gray[100] },
  confidenceFill: { height: 6, borderRadius: 3 },
  confidenceText: { fontSize: 11, fontWeight: '700' },

  suggestionsLabel: { fontSize: 11, color: C.gray[400], marginBottom: 8 },
  chipRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestionChip:   { backgroundColor: C.consumer.light, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.consumer.border },
  suggestionChipText: { fontSize: 12, color: C.consumer.primary, fontWeight: '600' },
});
