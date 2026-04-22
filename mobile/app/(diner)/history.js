import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const EMPTY = { restaurant_name: '', visit_date: '', overall_rating: 5, food_rating: 5, staff_rating: 5, would_return: true, notes: '' };

function StarPicker({ label, value, onChange }) {
  return (
    <View style={sp.row}>
      <Text style={sp.label}>{label}</Text>
      <View style={sp.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={[sp.star, n <= value && sp.starFilled]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={sp.val}>{value}/5</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label:      { fontSize: 13, fontWeight: '600', color: C.gray[700], width: 72 },
  stars:      { flexDirection: 'row', gap: 4, flex: 1 },
  star:       { fontSize: 26, color: C.gray[200] },
  starFilled: { color: '#f59e0b' },
  val:        { fontSize: 13, fontWeight: '600', color: C.gray[500], width: 28, textAlign: 'right' },
});

export default function HistoryScreen() {
  const [visits, setVisits]       = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { setVisits(await api.getDinerVisits()); } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormError(null); };

  const handleSave = async () => {
    if (!form.restaurant_name.trim() || !form.visit_date.trim()) {
      setFormError('Restaurant name and date are required.'); return;
    }
    setSaving(true); setFormError(null);
    try {
      await api.createDinerVisit(form);
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Could not save visit.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (v) =>
    Alert.alert('Remove Visit', `Remove your visit to ${v.restaurant_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteDinerVisit(v.id); load(); } },
    ]);

  const avgRating = visits.length
    ? (visits.reduce((s, v) => s + (v.overall_rating || 0), 0) / visits.length).toFixed(1)
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Visit History</Text>
          {visits.length > 0 && <Text style={styles.sub}>{visits.length} visits · ⭐ {avgRating} avg</Text>}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setShowForm(!showForm); setForm(EMPTY); setFormError(null); }}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Log Visit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Log a Visit</Text>

            <Text style={styles.label}>Restaurant</Text>
            <TextInput style={styles.input} value={form.restaurant_name} onChangeText={(v) => set('restaurant_name', v)} placeholder="Where did you go?" />

            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} value={form.visit_date} onChangeText={(v) => set('visit_date', v)} placeholder="YYYY-MM-DD" />

            <StarPicker label="Overall" value={form.overall_rating} onChange={(v) => set('overall_rating', v)} />
            <StarPicker label="Food"    value={form.food_rating}    onChange={(v) => set('food_rating', v)} />
            <StarPicker label="Staff"   value={form.staff_rating}   onChange={(v) => set('staff_rating', v)} />

            <View style={styles.returnRow}>
              <Text style={styles.label}>Would you return?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[true, false].map((val) => (
                  <TouchableOpacity key={String(val)} style={[styles.returnBtn, form.would_return === val && styles.returnBtnActive]} onPress={() => set('would_return', val)}>
                    <Text style={[styles.returnBtnText, form.would_return === val && { color: '#fff' }]}>{val ? 'Yes' : 'No'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="What stood out?" multiline />

            {formError && <Text style={styles.formError}>{formError}</Text>}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Visit</Text>}
            </TouchableOpacity>
          </View>
        )}

        {visits.map((v) => (
          <View key={v.id} style={styles.visitCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.restaurant}>{v.restaurant_name}</Text>
                <Text style={styles.date}>{v.visit_date}</Text>
                <View style={styles.ratingsRow}>
                  <RatingChip label="Overall" value={v.overall_rating} />
                  <RatingChip label="Food"    value={v.food_rating} />
                  <RatingChip label="Staff"   value={v.staff_rating} />
                </View>
                {v.notes && <Text style={styles.notes}>"{v.notes}"</Text>}
                {!v.would_return && <Text style={styles.noReturn}>Wouldn't return</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(v)} style={{ padding: 4, marginLeft: 8 }}>
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {visits.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyText}>Your dining journal is empty</Text>
            <Text style={styles.emptySub}>Log your first visit to start building your history</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function RatingChip({ label, value }) {
  const color = value >= 4 ? C.green : value >= 3 ? C.amber : C.red;
  return (
    <View style={{ alignItems: 'center', marginRight: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color }}>{value?.toFixed(1)}</Text>
      <Text style={{ fontSize: 10, color: C.gray[400] }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:           { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:             { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:          { backgroundColor: C.diner.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  formCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  formTitle:       { fontSize: 16, fontWeight: '800', color: C.gray[900], marginBottom: 14 },
  label:           { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:           { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50], marginBottom: 12 },
  returnRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  returnBtn:       { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: C.diner.primary },
  returnBtnActive: { backgroundColor: C.diner.primary },
  returnBtnText:   { fontSize: 13, fontWeight: '700', color: C.diner.primary },
  formError:       { color: C.red, fontSize: 13, marginBottom: 8 },
  saveBtn:         { backgroundColor: C.diner.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  visitCard:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  restaurant:      { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  date:            { fontSize: 12, color: C.gray[400], marginTop: 2, marginBottom: 8 },
  ratingsRow:      { flexDirection: 'row', marginBottom: 6 },
  notes:           { fontSize: 12, color: C.gray[500], fontStyle: 'italic', marginTop: 4 },
  noReturn:        { fontSize: 11, color: C.red, marginTop: 4 },
  empty:           { alignItems: 'center', marginTop: 40 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 17, fontWeight: '700', color: C.gray[700] },
  emptySub:        { fontSize: 13, color: C.gray[500], marginTop: 6, textAlign: 'center' },
});
