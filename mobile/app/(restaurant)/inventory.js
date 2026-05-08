import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Modal, FlatList, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { casePackFor } from '../../utils/casePacks';


const CATEGORIES = [
  { value: 'alcohol',        label: 'Alcohol',        bg: '#f3e8ff', fg: '#7c3aed' },
  { value: 'food',           label: 'Food',           bg: '#ffedd5', fg: '#ea580c' },
  { value: 'produce',        label: 'Produce',        bg: '#dcfce7', fg: '#16a34a' },
  { value: 'dry_goods',      label: 'Dry goods',      bg: '#fef9c3', fg: '#a16207' },
  { value: 'kitchen_supply', label: 'Kitchen supply', bg: '#dbeafe', fg: '#1d4ed8' },
  { value: 'cleaning',       label: 'Cleaning',       bg: '#e5e7eb', fg: '#374151' },
];

const UNITS = ['bottles', 'cases', 'kg', 'lbs', 'each', 'liters'];
const ADJUST_TYPES = [
  { value: 'delivery',         label: 'Delivery' },
  { value: 'usage',            label: 'Usage' },
  { value: 'waste',            label: 'Waste' },
  { value: 'count_correction', label: 'Correction' },
];


function categoryStyle(value) {
  return CATEGORIES.find((c) => c.value === value) ||
    { label: value, bg: '#e5e7eb', fg: '#374151' };
}


export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState(null);

  const load = async () => {
    try {
      const data = await api.getInventory(filter);
      const sorted = [...data].sort((a, b) => {
        if (a.is_low !== b.is_low) return a.is_low ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setItems(sorted);
      setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter]));

  if (loading) return <LoadingSpinner message="Loading inventory…" color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <SafeScreen>
      <View style={styles.topBar}>
        <Text style={styles.title}>Inventory</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={styles.filterRow} showsHorizontalScrollIndicator={false}>
        <FilterChip label="All" active={filter === null} onPress={() => setFilter(null)} />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.value}
            label={c.label}
            active={filter === c.value}
            onPress={() => setFilter(c.value)}
            color={c.fg}
          />
        ))}
      </ScrollView>

      {items.length === 0 ? (
        <View style={styles.emptyState} testID="inventory-empty">
          <Text style={styles.emptyTitle}>No inventory items yet</Text>
          <Text style={styles.emptySub}>Tap + Add to start tracking your stock.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              onAdjust={() => setAdjustingItem(item)}
            />
          )}
        />
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {adjustingItem && (
        <AdjustBottomSheet
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSaved={() => { setAdjustingItem(null); load(); }}
        />
      )}
    </SafeScreen>
  );
}


function FilterChip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, color && !active && { borderColor: color }]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive, color && !active && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}


function ItemRow({ item, onAdjust }) {
  const cat = categoryStyle(item.category);
  return (
    <TouchableOpacity onPress={onAdjust} style={[styles.row, item.is_low && styles.rowLow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
            <Text style={[styles.catBadgeText, { color: cat.fg }]}>{cat.label}</Text>
          </View>
          {item.is_low && (
            <View style={styles.lowBadge}>
              <Text style={styles.lowBadgeText}>⚠ Low</Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.qty}>{item.current_quantity} / {item.par_level}</Text>
        <Text style={styles.qtyUnit}>{item.unit}</Text>
      </View>
    </TouchableOpacity>
  );
}


function AdjustBottomSheet({ item, onClose, onSaved }) {
  const casePack = casePackFor(item.unit);
  const [delta, setDelta] = useState(0);
  const [type, setType] = useState('delivery');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const bump = (n) => {
    Haptics.impactAsync(Math.abs(n) === 1 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    setDelta((d) => d + n);
    if (n > 0 && type !== 'delivery') setType('delivery');
    if (n < 0 && type !== 'usage' && type !== 'waste') setType('usage');
  };

  const save = async () => {
    if (delta === 0) { Alert.alert('Choose a quantity', 'Tap +/- to set the change first.'); return; }
    setSaving(true);
    try {
      await api.adjustInventoryItem(item.id, {
        adjustment_type: type,
        delta,
        note: note || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Adjustment failed', e.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const projected = item.current_quantity + delta;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{item.name}</Text>
          <Text style={styles.sheetCurrent}>
            {item.current_quantity} {item.unit}
            {delta !== 0 && (
              <Text style={[styles.sheetDelta, delta > 0 ? styles.deltaPos : styles.deltaNeg]}>
                {' '} → {projected}
              </Text>
            )}
          </Text>

          <View style={styles.typeChips}>
            {ADJUST_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                style={[styles.typeChip, type === t.value && styles.typeChipActive]}
                testID={`type-${t.value}`}
              >
                <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bumpGrid}>
            <BumpButton label="+1"           onPress={() => bump(1)}            testID="bump-plus-1" />
            <BumpButton label="−1"           onPress={() => bump(-1)}           testID="bump-minus-1" />
            <BumpButton label={`+ Case (${casePack})`} onPress={() => bump(casePack)}  testID="bump-plus-case" />
            <BumpButton label={`− Case (${casePack})`} onPress={() => bump(-casePack)} testID="bump-minus-case" />
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={C.gray[400]}
            style={styles.noteInput}
          />

          <View style={styles.sheetActions}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


function BumpButton({ label, onPress, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.bumpBtn}>
      <Text style={styles.bumpBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}


function AddItemModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', category: 'food', unit: 'each', par_level: '',
  });
  const [categorizing, setCategorizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const onNameBlur = async () => {
    if (!form.name || form.name.trim().length < 3) return;
    setCategorizing(true);
    try {
      const res = await api.categorizeInventoryItem(form.name);
      if (res.category && res.confidence > 0) update('category')(res.category);
    } catch {}
    finally { setCategorizing(false); }
  };

  const submit = async () => {
    if (!form.name.trim()) { Alert.alert('Missing name', 'Item name is required.'); return; }
    if (form.par_level === '' || parseFloat(form.par_level) < 0) {
      Alert.alert('Invalid par', 'Par level must be 0 or greater.'); return;
    }
    setSaving(true);
    try {
      await api.createInventoryItem({
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        par_level: parseFloat(form.par_level),
      });
      onSaved();
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add inventory item</Text>

          <TextInput
            value={form.name}
            onChangeText={update('name')}
            onBlur={onNameBlur}
            placeholder="e.g. Tito's Vodka 1.75L"
            placeholderTextColor={C.gray[400]}
            style={styles.noteInput}
            testID="add-name-input"
          />
          {categorizing && <Text style={styles.helpText}>Suggesting category…</Text>}

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal style={{ marginBottom: 12 }} showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => update('category')(c.value)}
                style={[styles.typeChip, form.category === c.value && styles.typeChipActive]}
                testID={`add-category-${c.value}`}
              >
                <Text style={[styles.typeChipText, form.category === c.value && styles.typeChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Unit</Text>
          <ScrollView horizontal style={{ marginBottom: 12 }} showsHorizontalScrollIndicator={false}>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => update('unit')(u)}
                style={[styles.typeChip, form.unit === u && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, form.unit === u && styles.typeChipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={form.par_level}
            onChangeText={update('par_level')}
            placeholder="Par level (warn-below threshold)"
            placeholderTextColor={C.gray[400]}
            keyboardType="numeric"
            style={styles.noteInput}
          />

          <View style={styles.sheetActions}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Add item'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title:         { fontSize: 22, fontWeight: '700', color: C.gray[900] },
  addBtn:        { backgroundColor: C.gray[900], paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText:    { color: '#fff', fontSize: 13, fontWeight: '600' },

  filterRow:     { paddingHorizontal: 12, marginBottom: 8, maxHeight: 44 },
  chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent' },
  chipActive:    { backgroundColor: C.gray[900] },
  chipLabel:     { fontSize: 12, fontWeight: '600', color: C.gray[600] },
  chipLabelActive:{ color: '#fff' },

  emptyState:    { padding: 24, alignItems: 'center', marginTop: 60 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: C.gray[900], marginBottom: 4 },
  emptySub:      { fontSize: 13, color: C.gray[500], textAlign: 'center' },

  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  rowLow:        { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  itemName:      { fontSize: 15, fontWeight: '600', color: C.gray[900] },
  catBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 6 },
  catBadgeText:  { fontSize: 11, fontWeight: '600' },
  lowBadge:      { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  lowBadgeText:  { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  qty:           { fontSize: 18, fontWeight: '700', color: C.gray[900], fontVariant: ['tabular-nums'] },
  qtyUnit:       { fontSize: 11, color: C.gray[500], marginTop: 2 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  sheetTitle:    { fontSize: 18, fontWeight: '700', color: C.gray[900] },
  sheetCurrent:  { fontSize: 16, color: C.gray[600], marginTop: 4, marginBottom: 16 },
  sheetDelta:    { fontWeight: '700' },
  deltaPos:      { color: '#16a34a' },
  deltaNeg:      { color: '#dc2626' },

  typeChips:     { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  typeChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, marginBottom: 6, backgroundColor: '#f1f5f9' },
  typeChipActive:{ backgroundColor: C.gray[900] },
  typeChipText:  { fontSize: 12, color: C.gray[600], fontWeight: '600' },
  typeChipTextActive: { color: '#fff' },

  bumpGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  bumpBtn:       { width: '48%', height: 64, marginBottom: 8, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bumpBtnText:   { fontSize: 18, fontWeight: '700', color: C.gray[900] },

  noteInput:     { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, fontSize: 14, color: C.gray[900], marginBottom: 12 },
  label:         { fontSize: 11, fontWeight: '700', color: C.gray[600], textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  helpText:      { fontSize: 11, color: C.gray[400], marginTop: -8, marginBottom: 8 },

  sheetActions:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn:     { paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, color: C.gray[600] },
  saveBtn:       { backgroundColor: C.gray[900], paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  saveBtnText:   { fontSize: 14, color: '#fff', fontWeight: '600' },
});
