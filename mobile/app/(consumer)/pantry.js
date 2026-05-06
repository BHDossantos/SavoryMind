import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

const CATEGORIES = [
  { id: 'produce', label: '🥦 Produce' },
  { id: 'protein', label: '🍗 Protein' },
  { id: 'pantry',  label: '🥫 Pantry' },
  { id: 'dairy',   label: '🧀 Dairy' },
  { id: 'spice',   label: '🧂 Spices' },
  { id: 'other',   label: '🥢 Other' },
];

export default function PantryScreen() {
  const router = useRouter();
  const [items, setItems]       = useState([]);
  const [recipes, setRecipes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [form, setForm]         = useState({ ingredient: '', quantity: '', category: 'produce' });

  const load = async () => {
    try { setItems(await api.getPantry()); }
    catch {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleAdd = async () => {
    if (!form.ingredient.trim()) return;
    setAdding(true);
    try {
      const item = await api.addPantryItem({
        ingredient: form.ingredient.trim(),
        quantity:   form.quantity.trim() || null,
        category:   form.category,
      });
      setItems((prev) => [...prev, item]);
      setForm({ ingredient: '', quantity: '', category: form.category });
    } catch (e) {
      Alert.alert('Could not add', e.message || 'Try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await api.deletePantryItem(id); }
    catch { load(); }
  };

  const handleClear = () => {
    Alert.alert('Clear pantry?', 'Removes all ingredients. Recipe matches will reset.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await api.clearPantry().catch(() => {});
        setItems([]); setRecipes([]);
      }},
    ]);
  };

  const handleFindRecipes = async () => {
    setRecipesLoading(true);
    try { setRecipes(await api.getPantryRecipes()); }
    catch (e) { Alert.alert('Could not load recipes', e.message || 'Try again.'); }
    finally { setRecipesLoading(false); }
  };

  if (loading) return (
    <SafeScreen><View style={{ padding: 24 }}><ActivityIndicator color={C.consumer.primary} /></View></SafeScreen>
  );

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => (i.category || 'other') === c.id),
  })).filter((g) => g.items.length > 0);

  return (
    <SafeScreen onRefresh={load}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>🥫 Pantry</Text>
            <Text style={styles.sub}>What's on hand → what you can cook tonight</Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity onPress={handleClear}><Text style={styles.clearLink}>Clear</Text></TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.addCard}>
        <TextInput
          style={styles.input}
          value={form.ingredient}
          onChangeText={(t) => setForm((f) => ({ ...f, ingredient: t }))}
          placeholder="What's in the fridge?"
          placeholderTextColor={C.gray[400]}
        />
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={form.quantity}
          onChangeText={(t) => setForm((f) => ({ ...f, quantity: t }))}
          placeholder="Qty (optional)"
          placeholderTextColor={C.gray[400]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setForm((f) => ({ ...f, category: c.id }))}
              style={[styles.catChip, form.category === c.id && styles.catChipActive]}
            >
              <Text style={[styles.catText, form.category === c.id && styles.catTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.addBtn, (!form.ingredient.trim() || adding) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!form.ingredient.trim() || adding}
        >
          <Text style={styles.addBtnText}>{adding ? 'Adding…' : '+ Add to pantry'}</Text>
        </TouchableOpacity>
      </View>

      {grouped.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🥫</Text>
          <Text style={styles.emptyTitle}>Your pantry is empty</Text>
          <Text style={styles.emptySub}>Add ingredients above so we can suggest recipes you can make right now.</Text>
        </View>
      ) : (
        grouped.map((g) => (
          <View key={g.id} style={styles.group}>
            <Text style={styles.groupTitle}>{g.label}</Text>
            {g.items.map((i) => (
              <View key={i.id} style={styles.row}>
                <Text style={styles.rowName}>{i.ingredient}</Text>
                {i.quantity && <Text style={styles.rowQty}>{i.quantity}</Text>}
                <TouchableOpacity onPress={() => handleDelete(i.id)} hitSlop={10}>
                  <Text style={styles.rowDelete}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))
      )}

      {items.length > 0 && (
        <View style={styles.recipesCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.recipesTitle}>What can I make?</Text>
            <TouchableOpacity onPress={handleFindRecipes} disabled={recipesLoading}>
              <Text style={styles.recipesAction}>
                {recipesLoading ? '…' : recipes.length === 0 ? 'Find recipes →' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
          {recipes.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.recipeRow}
              onPress={() => router.push({ pathname: '/(consumer)/recipes', params: { id: r.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeName}>{r.name}</Text>
                {r.match_pct != null && (
                  <Text style={styles.recipeMatch}>{Math.round(r.match_pct)}% match · {r.have_count}/{r.need_count} ingredients</Text>
                )}
              </View>
              <Text style={styles.recipeArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header:        { padding: 16 },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:           { fontSize: 13, color: C.gray[500], marginTop: 2 },
  clearLink:     { fontSize: 13, color: C.red, fontWeight: '600' },
  addCard:       { marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.consumer.border },
  input:         { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, padding: 10, fontSize: 14, color: C.gray[900], backgroundColor: C.gray[50] },
  catChip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.gray[200], marginRight: 6, backgroundColor: '#fff' },
  catChipActive: { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  catText:       { fontSize: 12, color: C.gray[600] },
  catTextActive: { color: C.consumer.text, fontWeight: '700' },
  addBtn:        { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: C.consumer.primary, alignItems: 'center' },
  addBtnDisabled:{ backgroundColor: C.gray[300] },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:         { padding: 32, alignItems: 'center' },
  emptyEmoji:    { fontSize: 36, marginBottom: 6 },
  emptyTitle:    { fontSize: 15, fontWeight: '700', color: C.gray[800] },
  emptySub:      { fontSize: 12, color: C.gray[500], marginTop: 4, textAlign: 'center' },
  group:         { marginHorizontal: 16, marginBottom: 12 },
  groupTitle:    { fontSize: 11, fontWeight: '800', color: C.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: C.gray[100] },
  rowName:       { flex: 1, fontSize: 14, color: C.gray[800] },
  rowQty:        { fontSize: 12, color: C.gray[500], marginRight: 12 },
  rowDelete:     { fontSize: 16, color: C.gray[400] },
  recipesCard:   { marginHorizontal: 16, marginBottom: 24, padding: 14, borderRadius: 14, backgroundColor: C.consumer.light, borderWidth: 1, borderColor: C.consumer.border },
  recipesTitle:  { fontSize: 15, fontWeight: '700', color: C.consumer.text },
  recipesAction: { fontSize: 13, color: C.consumer.primary, fontWeight: '700' },
  recipeRow:     { flexDirection: 'row', alignItems: 'center', padding: 10, marginTop: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.consumer.border },
  recipeName:    { fontSize: 14, fontWeight: '600', color: C.gray[800] },
  recipeMatch:   { fontSize: 12, color: C.gray[500], marginTop: 2 },
  recipeArrow:   { fontSize: 16, color: C.consumer.primary, fontWeight: '700' },
});
