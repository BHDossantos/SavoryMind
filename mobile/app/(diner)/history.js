import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const EMPTY = { restaurant_name: '', visit_date: '', overall_rating: '5', food_rating: '5', staff_rating: '5', would_return: true, notes: '' };

export default function HistoryScreen() {
  const [visits, setVisits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { const data = await api.getDinerVisits(); setVisits(data); } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormError(null); };

  const handleSave = async () => {
    if (!form.restaurant_name.trim() || !form.visit_date.trim()) {
      setFormError('Restaurant name and date are required.'); return;
    }
    setSaving(true); setFormError(null);
    try {
      await api.createDinerVisit({
        ...form,
        overall_rating: parseFloat(form.overall_rating) || 5,
        food_rating: parseFloat(form.food_rating) || 5,
        staff_rating: parseFloat(form.staff_rating) || 5,
      });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Could not save visit.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (v) =>
    Alert.alert('Remove Visit', `Remove your visit to ${v.restaurant_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteDinerVisit(v.id); load(); } },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Visit History</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Log Visit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Log a Visit</Text>
            {[
              { key: 'restaurant_name', label: 'Restaurant', placeholder: 'Where did you go?' },
              { key: 'visit_date', label: 'Date', placeholder: 'YYYY-MM-DD' },
              { key: 'overall_rating', label: 'Overall Rating (1–5)', kb: 'decimal-pad' },
              { key: 'food_rating', label: 'Food Rating (1–5)', kb: 'decimal-pad' },
              { key: 'staff_rating', label: 'Staff Rating (1–5)', kb: 'decimal-pad' },
              { key: 'notes', label: 'Notes (optional)', placeholder: 'What stood out?' },
            ].map(({ key, label, placeholder, kb }) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <Text style={styles.label}>{label}</Text>
                <TextInput style={styles.input} value={form[key]} onChangeText={(v) => set(key, v)} placeholder={placeholder || label} keyboardType={kb || 'default'} />
              </View>
            ))}
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
            {formError && <Text style={styles.formError}>{formError}</Text>}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Visit</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.count}>{visits.length} {visits.length === 1 ? 'visit' : 'visits'} logged</Text>

        {visits.map((v) => (
          <View key={v.id} style={styles.visitCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.restaurant}>{v.restaurant_name}</Text>
                <Text style={styles.date}>{v.visit_date}</Text>
                <View style={styles.ratingsRow}>
                  <RatingChip label="Overall" value={v.overall_rating} />
                  <RatingChip label="Food" value={v.food_rating} />
                  <RatingChip label="Staff" value={v.staff_rating} />
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
    <View style={{ alignItems: 'center', marginRight: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{value?.toFixed(1)}</Text>
      <Text style={{ fontSize: 10, color: C.gray[400] }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  addBtn:       { backgroundColor: C.diner.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  formCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  formTitle:    { fontSize: 16, fontWeight: '800', color: C.gray[900], marginBottom: 14 },
  label:        { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  returnRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  returnBtn:    { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: C.diner.primary },
  returnBtnActive:{ backgroundColor: C.diner.primary },
  returnBtnText:{ fontSize: 13, fontWeight: '700', color: C.diner.primary },
  formError:    { color: C.red, fontSize: 13, marginBottom: 8 },
  saveBtn:      { backgroundColor: C.diner.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  count:        { fontSize: 13, color: C.gray[400], marginBottom: 12 },
  visitCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  restaurant:   { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  date:         { fontSize: 12, color: C.gray[400], marginTop: 2, marginBottom: 8 },
  ratingsRow:   { flexDirection: 'row', marginBottom: 6 },
  notes:        { fontSize: 12, color: C.gray[500], fontStyle: 'italic', marginTop: 4 },
  noReturn:     { fontSize: 11, color: C.red, marginTop: 4 },
  empty:        { alignItems: 'center', marginTop: 40 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 17, fontWeight: '700', color: C.gray[700] },
  emptySub:     { fontSize: 13, color: C.gray[500], marginTop: 6, textAlign: 'center' },
});
