import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const MOODS    = ['Happy', 'Cozy', 'Adventurous', 'Romantic', 'Quick'];
const CUISINES = ['Italian', 'Japanese', 'Mexican', 'French', 'Indian', 'American'];

export default function RecipesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [recipes, setRecipes]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [keywords, setKeywords]       = useState('');
  const [mood, setMood]               = useState('');
  const [cuisine, setCuisine]         = useState('');
  const [selected, setSelected]       = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const debounceRef = useRef(null);

  const load = async (kw = keywords, m = mood, c = cuisine) => {
    setLoading(true);
    try {
      const params = {};
      if (m)          params.mood     = m;
      if (c)          params.cuisine  = c;
      if (kw.trim())  params.keywords = kw.trim();
      setRecipes(await api.getRecipes(params));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleMood = (m) => {
    const next = mood === m ? '' : m;
    setMood(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(keywords, next, cuisine), 300);
  };

  const toggleCuisine = (c) => {
    const next = cuisine === c ? '' : c;
    setCuisine(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(keywords, mood, next), 300);
  };

  const openRecipe = async (r) => {
    setLoadingDetail(true); setSelected({ ...r, loading: true });
    try { setSelected(await api.getRecipe(r.id)); }
    catch { setSelected(r); }
    finally { setLoadingDetail(false); }
  };

  const difficultyColor = (d) => {
    if (!d) return C.gray[400];
    const dl = d.toLowerCase();
    return dl === 'easy' ? C.green : dl === 'medium' ? C.amber : C.red;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('screens.recipes.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={keywords}
            onChangeText={setKeywords}
            placeholder="Search ingredients or dish..."
            returnKeyType="search"
            onSubmitEditing={() => load()}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => load()}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.filterLabel}>Mood</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {MOODS.map((m) => (
            <TouchableOpacity key={m} style={[styles.chip, mood === m && styles.chipActive]} onPress={() => toggleMood(m)}>
              <Text style={[styles.chipText, mood === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Cuisine</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {CUISINES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, cuisine === c && styles.chipActive]} onPress={() => toggleCuisine(c)}>
              <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {(mood || cuisine) && (
          <TouchableOpacity onPress={() => { setMood(''); setCuisine(''); load(keywords, '', ''); }} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕ Clear filters</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={C.consumer.primary} style={{ marginTop: 40 }} />
        ) : recipes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>👨‍🍳</Text>
            <Text style={styles.emptyText}>No recipes found</Text>
            <Text style={styles.emptySub}>Try different filters or search terms</Text>
          </View>
        ) : (
          recipes.map((r) => (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => openRecipe(r)} activeOpacity={0.85}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{r.name}</Text>
                <Text style={styles.cardTime}>{r.prep_time_minutes + r.cook_time_minutes} min</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.cardMetaText}>{r.cuisine} · {r.mood}</Text>
                <Text style={[styles.diffBadge, { color: difficultyColor(r.difficulty), borderColor: difficultyColor(r.difficulty) }]}>{r.difficulty}</Text>
              </View>
              {r.description && <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.modalTop}>
            <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color: C.gray[500], fontSize: 15 }}>Close</Text></TouchableOpacity>
          </View>
          {selected?.loading ? (
            <ActivityIndicator color={C.consumer.primary} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalMeta}>{selected?.cuisine} · {selected?.mood} · {selected?.difficulty}</Text>
              {selected?.description && <Text style={styles.modalDesc}>{selected.description}</Text>}
              <View style={styles.metaRow}>
                <MetaBox icon="⏱️" label="Prep"  value={`${selected?.prep_time_minutes}m`} />
                <MetaBox icon="🔥" label="Cook"  value={`${selected?.cook_time_minutes}m`} />
                <MetaBox icon="👥" label="Serves" value={selected?.servings} />
              </View>
              {selected?.ingredients?.length > 0 && (
                <>
                  <Text style={styles.sectionHead}>Ingredients</Text>
                  {selected.ingredients.map((ing, i) => (
                    <Text key={i} style={styles.ingredient}>• {ing}</Text>
                  ))}
                </>
              )}
              {selected?.id != null && (
                <TouchableOpacity
                  testID="start-guided-cooking"
                  onPress={() => { router.push({ pathname: '/(consumer)/guided-cooking', params: { id: selected.id } }); setSelected(null); }}
                  style={styles.startCookingBtn}
                >
                  <Text style={styles.startCookingBtnText}>👨‍🍳 Start guided cooking</Text>
                </TouchableOpacity>
              )}

              {selected?.instructions?.length > 0 && (
                <>
                  <Text style={styles.sectionHead}>Instructions</Text>
                  {selected.instructions.map((step, i) => (
                    <View key={i} style={styles.step}>
                      <Text style={styles.stepNum}>{i + 1}</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

function MetaBox({ icon, label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ fontSize: 12, color: C.gray[500], marginTop: 2 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.gray[800] }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  searchRow:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
  input:        { flex: 1, borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  searchBtn:    { backgroundColor: C.consumer.primary, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  filterLabel:  { fontSize: 12, fontWeight: '600', color: C.gray[500], marginBottom: 6 },
  chip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff', marginRight: 8 },
  chipActive:   { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  chipText:     { fontSize: 12, color: C.gray[600] },
  chipTextActive:{ color: C.consumer.primary, fontWeight: '700' },
  clearBtn:     { alignSelf: 'flex-start', marginBottom: 12 },
  clearBtnText: { fontSize: 12, color: C.consumer.muted, fontWeight: '600' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName:     { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1, marginRight: 8 },
  cardTime:     { fontSize: 12, color: C.consumer.primary, fontWeight: '600' },
  cardMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardMetaText: { fontSize: 12, color: C.gray[500] },
  diffBadge:    { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  cardDesc:     { fontSize: 13, color: C.gray[600], marginTop: 6, lineHeight: 18 },
  emptyBox:     { alignItems: 'center', marginTop: 48 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 16, fontWeight: '700', color: C.gray[700] },
  emptySub:     { fontSize: 13, color: C.gray[400], marginTop: 6 },
  modalTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.gray[100] },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.gray[900], flex: 1, marginRight: 12 },
  modalMeta:    { fontSize: 13, color: C.gray[500], marginBottom: 8, marginTop: 16 },
  modalDesc:    { fontSize: 14, color: C.gray[600], lineHeight: 21, marginBottom: 16 },
  metaRow:      { flexDirection: 'row', backgroundColor: C.consumer.light, borderRadius: 14, padding: 16, marginBottom: 20 },
  startCookingBtn: { backgroundColor: C.consumer.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  startCookingBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionHead:  { fontSize: 16, fontWeight: '800', color: C.gray[900], marginBottom: 10, marginTop: 8 },
  ingredient:   { fontSize: 14, color: C.gray[700], marginBottom: 5, lineHeight: 20 },
  step:         { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNum:      { width: 26, height: 26, borderRadius: 13, backgroundColor: C.consumer.primary, color: '#fff', textAlign: 'center', lineHeight: 26, fontSize: 13, fontWeight: '700', flexShrink: 0 },
  stepText:     { flex: 1, fontSize: 14, color: C.gray[700], lineHeight: 21 },
});
