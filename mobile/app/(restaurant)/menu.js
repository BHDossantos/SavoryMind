import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

// Category enum values stay in English — they're the canonical strings
// the backend stores. The DISPLAY of each cat goes through t() below.
const CATS = ['All', 'Mains', 'Starters', 'Desserts', 'Drinks'];
const EMPTY = { name: '', category: 'Mains', price: '', cost: '', orders_last_30_days: '', rating: '', description: '' };

function MarginBadge({ margin }) {
  const color = margin >= 60 ? C.green : margin >= 40 ? C.amber : C.red;
  return <Text style={[styles.badge, { color, borderColor: color }]}>{margin.toFixed(0)}%</Text>;
}

export default function MenuScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Canonical category value → translated label. Lives inline so it
  // re-evaluates on language switch.
  const CAT_LABEL = {
    All:      t('menuScreen.catAll'),
    Mains:    t('menuScreen.catMains'),
    Starters: t('menuScreen.catStarters'),
    Desserts: t('menuScreen.catDesserts'),
    Drinks:   t('menuScreen.catDrinks'),
  };

  const load = async () => {
    try {
      const data = await api.getMenuItems();
      setItems(data);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = items.filter(
    (i) => (category === 'All' || i.category === category) &&
           (search === '' || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, price: String(item.price), cost: String(item.cost), orders_last_30_days: String(item.orders_last_30_days), rating: String(item.rating), description: item.description || '' });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY); setFormError(null); };

  const handleSave = async () => {
    const price = parseFloat(form.price), cost = parseFloat(form.cost);
    if (!form.name.trim()) { setFormError(t('menuScreen.errNameRequired')); return; }
    if (isNaN(price) || price <= 0) { setFormError(t('menuScreen.errPricePositive')); return; }
    if (isNaN(cost) || cost < 0) { setFormError(t('menuScreen.errCostNegative')); return; }
    if (cost >= price) { setFormError(t('menuScreen.errCostBelowPrice')); return; }
    setSaving(true); setFormError(null);
    try {
      const payload = { ...form, price, cost, orders_last_30_days: parseInt(form.orders_last_30_days) || 0, rating: form.rating !== '' ? parseFloat(form.rating) : 0 };
      if (editing) await api.updateMenuItem(editing.id, payload);
      else await api.createMenuItem(payload);
      closeForm(); load();
    } catch (e) { setFormError(e.message || t('menuScreen.errSaveFailed')); }
    finally { setSaving(false); }
  };

  const handleDelete = (item) =>
    Alert.alert(t('menuScreen.deleteTitle'), t('menuScreen.deleteBody', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('menuScreen.delete'), style: 'destructive', onPress: async () => { await api.deleteMenuItem(item.id); load(); } },
    ]);

  if (loading) return <LoadingSpinner message={t('menuScreen.loading')} color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('menuScreen.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>{t('menuScreen.addBtn')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <TextInput style={styles.search} placeholder={t('menuScreen.searchPlaceholder')} value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} style={[styles.catBtn, category === c && styles.catBtnActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.catText, category === c && styles.catTextActive]}>{CAT_LABEL[c]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {filtered.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCat}>{CAT_LABEL[item.category] || item.category}</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                <MarginBadge margin={item.profit_margin} />
                <Text style={styles.itemOrders}>{t('menuScreen.ordersN', { count: item.orders_last_30_days })}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}><Text>✏️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}><Text>🗑️</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>{t('menuScreen.empty')}</Text>}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
        <SafeScreen>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={styles.modalTitle}>{editing ? t('menuScreen.modalEdit', { name: editing.name }) : t('menuScreen.modalNew')}</Text>
            <TouchableOpacity onPress={closeForm}><Text style={{ fontSize: 16, color: C.gray[500] }}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>

          {[
            { key: 'name',                label: t('menuScreen.labelName') },
            { key: 'price',               label: t('menuScreen.labelPrice'),       kb: 'decimal-pad' },
            { key: 'cost',                label: t('menuScreen.labelCost'),        kb: 'decimal-pad' },
            { key: 'orders_last_30_days', label: t('menuScreen.labelOrders'),      kb: 'number-pad' },
            { key: 'rating',              label: t('menuScreen.labelRating'),      kb: 'decimal-pad' },
            { key: 'description',         label: t('menuScreen.labelDescription') },
          ].map(({ key, label, kb }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={form[key]} onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))} keyboardType={kb || 'default'} />
            </View>
          ))}

          <Text style={styles.label}>{t('menuScreen.labelCategory')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {['Mains', 'Starters', 'Desserts', 'Drinks'].map((c) => (
              <TouchableOpacity key={c} style={[styles.catBtn, form.category === c && styles.catBtnActive]} onPress={() => setForm((f) => ({ ...f, category: c }))}>
                <Text style={[styles.catText, form.category === c && styles.catTextActive]}>{CAT_LABEL[c]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {formError && <Text style={styles.formError}>{formError}</Text>}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? t('menuScreen.saveChanges') : t('menuScreen.addItem')}</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  addBtn:       { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  search:       { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff', marginBottom: 10 },
  catBtn:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], marginRight: 8, backgroundColor: '#fff' },
  catBtnActive: { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  catText:      { fontSize: 13, color: C.gray[600], fontWeight: '500' },
  catTextActive:{ color: '#fff', fontWeight: '700' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', borderWidth: 1, borderColor: C.gray[100] },
  itemName:     { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  itemCat:      { fontSize: 12, color: C.gray[400], marginTop: 2 },
  itemMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  itemPrice:    { fontSize: 14, fontWeight: '600', color: C.gray[800] },
  itemOrders:   { fontSize: 12, color: C.gray[500] },
  badge:        { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  actions:      { flexDirection: 'row', gap: 4, alignItems: 'flex-start' },
  editBtn:      { padding: 6 },
  deleteBtn:    { padding: 6 },
  empty:        { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  label:        { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:    { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:      { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
});
