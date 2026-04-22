import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const MOODS = ['Happy', 'Cozy', 'Adventurous', 'Romantic', 'Quick', ''];
const CUISINES = ['Italian', 'Japanese', 'Mexican', 'French', 'Indian', 'American', ''];

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState('');
  const [mood, setMood] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (mood) params.mood = mood;
      if (cuisine) params.cuisine = cuisine;
      if (keywords.trim()) params.keywords = keywords.trim();
      const data = await api.getRecipes(params);
      setRecipes(data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openRecipe = async (r) => {
    setLoadingDetail(true); setSelected({ ...r, loading: true });
    try {
      const detail = await api.getRecipe(r.id);
      setSelected(detail);
    } catch { setSelected(r); }
    finally { setLoadingDetail(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Recipe Discovery</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Filters */}
        <View style={styles.searchRow}>
          <TextInput style={styles.input} value={keywords} onChangeText={setKeywords} placeholder="Search ingredients or dish..." returnKeyType="search" onSubmitEditing={load} />
          <TouchableOpacity style={styles.searchBtn} onPress={load}><Text style={{ color: '#fff', fontWeight: '700' }}>Go</Text></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {MOODS.filter(Boolean).map((m) => (
            <TouchableOpacity key={m} style={[styles.chip, mood === m && styles.chipActive]} onPress={() => { setMood(mood === m ? '' : m); }}>
              <Text style={[styles.chipText, mood === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {CUISINES.filter(Boolean).map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, cuisine === c && styles.chipActive]} onPress={() => { setCuisine(cuisine === c ? '' : c); }}>
              <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={C.consumer.primary} style={{ marginTop: 40 }} />
        ) : (
          recipes.map((r) => (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => openRecipe(r)} activeOpacity={0.85}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{r.name}</Text>
                <Text style={styles.cardTime}>{r.prep_time_minutes + r.cook_time_minutes} min</Text>
              </View>
              <Text style={styles.cardMeta}>{r.cuisine} · {r.mood} · {r.servings} servings · ⭐ {r.difficulty}</Text>
              {r.description && <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>}
            </TouchableOpacity>
          ))
        )}
        {!loading && recipes.length === 0 && <Text style={styles.empty}>No recipes found. Try different filters.</Text>}
      </ScrollView>

      {/* Recipe Detail Modal */}
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
              <Text style={styles.modalMeta}>{selected?.cuisine} · {selected?.mood} · ⭐ {selected?.difficulty}</Text>
              {selected?.description && <Text style={styles.modalDesc}>{selected.description}</Text>}
              <View style={styles.metaRow}>
                <MetaBox icon="⏱️" label="Prep" value={`${selected?.prep_time_minutes}m`} />
                <MetaBox icon="🔥" label="Cook" value={`${selected?.cook_time_minutes}m`} />
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
  topBar:      { padding: 16, paddingTop: 56 },
  title:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  searchRow:   { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input:       { flex: 1, borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  searchBtn:   { backgroundColor: C.consumer.primary, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  chip:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff', marginRight: 8 },
  chipActive:  { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  chipText:    { fontSize: 12, color: C.gray[600] },
  chipTextActive:{ color: C.consumer.primary, fontWeight: '700' },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName:    { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1, marginRight: 8 },
  cardTime:    { fontSize: 12, color: C.consumer.primary, fontWeight: '600' },
  cardMeta:    { fontSize: 12, color: C.gray[500], marginTop: 4 },
  cardDesc:    { fontSize: 13, color: C.gray[600], marginTop: 6, lineHeight: 18 },
  empty:       { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.gray[100] },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: C.gray[900], flex: 1, marginRight: 12 },
  modalMeta:   { fontSize: 13, color: C.gray[500], marginBottom: 8 },
  modalDesc:   { fontSize: 14, color: C.gray[600], lineHeight: 21, marginBottom: 16 },
  metaRow:     { flexDirection: 'row', backgroundColor: C.consumer.light, borderRadius: 14, padding: 16, marginBottom: 20 },
  sectionHead: { fontSize: 16, fontWeight: '800', color: C.gray[900], marginBottom: 10, marginTop: 8 },
  ingredient:  { fontSize: 14, color: C.gray[700], marginBottom: 5, lineHeight: 20 },
  step:        { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNum:     { width: 26, height: 26, borderRadius: 13, backgroundColor: C.consumer.primary, color: '#fff', textAlign: 'center', lineHeight: 26, fontSize: 13, fontWeight: '700', flexShrink: 0 },
  stepText:    { flex: 1, fontSize: 14, color: C.gray[700], lineHeight: 21 },
});
