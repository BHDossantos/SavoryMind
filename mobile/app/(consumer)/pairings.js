import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { C } from '../../constants/colors';
import { api } from '../../services/api';

const TABS = ['Wine', 'Beer', 'Spirits'];

export default function PairingsScreen() {
  const [tab, setTab]         = useState('Wine');
  const [dish, setDish]       = useState('');
  const [result, setResult]   = useState(null);
  const [saved, setSaved]     = useState([]);
  const [session, setSession] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const loadSaved = async () => {
    try { setSaved(await api.getWinePairings()); } catch {}
  };
  useFocusEffect(useCallback(() => { loadSaved(); }, []));

  const handleSearch = async () => {
    if (!dish.trim()) { setError('Enter a dish name.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      let data;
      if (tab === 'Wine') {
        data = await api.createWinePairing({ dish: dish.trim(), mood: 'casual', occasion: 'dinner' });
        setResult({ type: 'wine', data });
        loadSaved();
      } else if (tab === 'Beer') {
        data = await api.getBeerPairing(dish.trim());
        setResult({ type: 'beer', data });
      } else {
        data = await api.getSpiritsPairing(dish.trim());
        setResult({ type: 'spirits', data });
      }
      setSession((h) => [{ tab, dish: dish.trim(), result: data }, ...h.slice(0, 9)]);
    } catch (e) { setError(e.message || 'Could not get pairing.'); }
    finally { setLoading(false); }
  };

  const history = tab === 'Wine'
    ? saved.slice(0, 8)
    : session.filter((s) => s.tab === tab).slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Pairings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => { setTab(t); setResult(null); setError(null); }}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'Wine' ? '🍷 ' : t === 'Beer' ? '🍺 ' : '🥃 '}{t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>What's on your plate?</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={dish}
            onChangeText={(v) => { setDish(v); setError(null); }}
            placeholder="e.g. Grilled salmon, Beef stew..."
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Find</Text>}
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{tab} pairing for "{dish}"</Text>
            {result.type === 'wine' && result.data && (
              <>
                <ResultRow label="Wine"        value={result.data.wine_recommendation} />
                <ResultRow label="Why"         value={result.data.pairing_reason} />
                {result.data.serving_temp   && <ResultRow label="Serve at"    value={result.data.serving_temp} />}
                {result.data.alternative_wine && <ResultRow label="Alternative" value={result.data.alternative_wine} />}
              </>
            )}
            {result.type === 'beer' && result.data && (
              <>
                <ResultRow label="Beer Style" value={result.data.beer_style} />
                <ResultRow label="Why"        value={result.data.pairing_reason} />
                {result.data.example_brands?.length > 0 && <ResultRow label="Try" value={result.data.example_brands.join(', ')} />}
              </>
            )}
            {result.type === 'spirits' && result.data && (
              <>
                <ResultRow label="Spirit"    value={result.data.spirit_recommendation} />
                <ResultRow label="Serve as"  value={result.data.serving_suggestion} />
                <ResultRow label="Why"       value={result.data.pairing_reason} />
              </>
            )}
          </View>
        )}

        {history.length > 0 && !result && (
          <>
            <Text style={styles.historyTitle}>
              {tab === 'Wine' ? 'Saved Wine Pairings' : `Recent ${tab} Pairings`}
            </Text>
            {history.map((h, i) => (
              <TouchableOpacity
                key={i}
                style={styles.historyItem}
                onPress={() => setDish(tab === 'Wine' ? h.dish : h.dish)}
              >
                <Text style={styles.historyIcon}>{tab === 'Wine' ? '🍷' : tab === 'Beer' ? '🍺' : '🥃'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDish}>{tab === 'Wine' ? h.dish : h.dish}</Text>
                  <Text style={styles.historyRec} numberOfLines={1}>
                    {tab === 'Wine'
                      ? (h.wine_recommendation || h.result?.wine_recommendation || '')
                      : tab === 'Beer'
                        ? (h.result?.beer_style || '')
                        : (h.result?.spirit_recommendation || '')}
                  </Text>
                </View>
                <Text style={styles.reuseHint}>↩</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ResultRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.rrLabel}>{label}</Text>
      <Text style={styles.rrValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:        { padding: 16, paddingTop: 56 },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  tabs:          { flexDirection: 'row', backgroundColor: C.gray[100], borderRadius: 12, padding: 4, marginBottom: 20 },
  tab:           { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:     { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  tabText:       { fontSize: 13, color: C.gray[500], fontWeight: '600' },
  tabTextActive: { color: C.consumer.primary, fontWeight: '700' },
  label:         { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 8 },
  inputRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:         { flex: 1, borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: '#fff' },
  searchBtn:     { backgroundColor: C.consumer.primary, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error:         { color: C.red, fontSize: 13, marginBottom: 10 },
  resultCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.consumer.border, marginBottom: 16 },
  resultTitle:   { fontSize: 14, fontWeight: '700', color: C.consumer.text, marginBottom: 12 },
  rrLabel:       { fontSize: 11, fontWeight: '600', color: C.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  rrValue:       { fontSize: 14, color: C.gray[800], lineHeight: 20 },
  historyTitle:  { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10 },
  historyItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  historyIcon:   { fontSize: 20 },
  historyDish:   { fontSize: 13, fontWeight: '600', color: C.gray[800] },
  historyRec:    { fontSize: 12, color: C.gray[400], marginTop: 2 },
  reuseHint:     { fontSize: 16, color: C.gray[300] },
});
