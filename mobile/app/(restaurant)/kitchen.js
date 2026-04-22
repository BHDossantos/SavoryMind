import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const EMPTY = { item_name: '', staff_name: '', prep_minutes: '', cook_minutes: '', notes: '' };

function SpeedBadge({ total }) {
  const fast = total <= 15, slow = total > 30;
  const color = fast ? C.green : slow ? C.red : C.amber;
  const label = fast ? 'Fast' : slow ? 'Slow' : 'On Track';
  return <Text style={[styles.speedBadge, { color, borderColor: color }]}>{label}</Text>;
}

export default function KitchenScreen() {
  const [times, setTimes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { setTimes(await api.getDishTimes()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.item_name.trim()) { setFormError('Dish name is required.'); return; }
    const prep = parseFloat(form.prep_minutes), cook = parseFloat(form.cook_minutes);
    if (isNaN(prep) || prep < 0) { setFormError('Prep time must be 0 or more minutes.'); return; }
    if (isNaN(cook) || cook <= 0) { setFormError('Cook time must be > 0 minutes.'); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createDishTime({ ...form, prep_minutes: prep, cook_minutes: cook });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (t) => Alert.alert('Delete Record', `Remove kitchen time for ${t.item_name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteDishTime(t.id); load(); } },
  ]);

  if (loading) return <LoadingSpinner message="Loading kitchen times..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const avgTotal = times.length
    ? (times.reduce((s, t) => s + t.prep_minutes + t.cook_minutes, 0) / times.length).toFixed(0)
    : null;

  // Group by dish for summary
  const byDish = times.reduce((acc, t) => {
    if (!acc[t.item_name]) acc[t.item_name] = { total: 0, count: 0 };
    acc[t.item_name].total += t.prep_minutes + t.cook_minutes;
    acc[t.item_name].count++;
    return acc;
  }, {});
  const slowest = Object.entries(byDish).sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)[0];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Kitchen Times</Text>
          <Text style={styles.sub}>{times.length} records{avgTotal ? ` · avg ${avgTotal} min` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {slowest && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertIcon}>⏱️</Text>
          <View>
            <Text style={styles.alertTitle}>Slowest dish: {slowest[0]}</Text>
            <Text style={styles.alertSub}>Avg {(slowest[1].total / slowest[1].count).toFixed(0)} min · {slowest[1].count} records</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {times.map(t => {
          const total = t.prep_minutes + t.cook_minutes;
          return (
            <View key={t.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.dishName}>{t.item_name}</Text>
                  <SpeedBadge total={total} />
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeValue}>{t.prep_minutes}m</Text>
                    <Text style={styles.timeLabel}>Prep</Text>
                  </View>
                  <Text style={styles.plus}>+</Text>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeValue}>{t.cook_minutes}m</Text>
                    <Text style={styles.timeLabel}>Cook</Text>
                  </View>
                  <Text style={styles.plus}>=</Text>
                  <View style={[styles.timeBox, styles.timeBoxTotal]}>
                    <Text style={[styles.timeValue, { color: C.restaurant.primary }]}>{total}m</Text>
                    <Text style={styles.timeLabel}>Total</Text>
                  </View>
                </View>
                {t.staff_name && <Text style={styles.staffMeta}>👨‍🍳 {t.staff_name} · {t.date}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(t)} style={{ padding: 4, alignSelf: 'flex-start' }}>
                <Text>🗑️</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {times.length === 0 && <Text style={styles.empty}>No kitchen times logged yet.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Kitchen Time</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
          {[
            { key: 'item_name', label: 'Dish Name *' },
            { key: 'staff_name', label: 'Staff Member' },
            { key: 'prep_minutes', label: 'Prep Time (minutes) *', kb: 'decimal-pad' },
            { key: 'cook_minutes', label: 'Cook Time (minutes) *', kb: 'decimal-pad' },
            { key: 'notes', label: 'Notes' },
          ].map(({ key, label, kb }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={form[key]} onChangeText={v => set(key, v)} keyboardType={kb || 'default'} />
            </View>
          ))}
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Record</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:         { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:      { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', borderRadius: 12, marginHorizontal: 16, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#fde68a' },
  alertIcon:   { fontSize: 22 },
  alertTitle:  { fontSize: 13, fontWeight: '700', color: '#92400e' },
  alertSub:    { fontSize: 11, color: '#b45309', marginTop: 1 },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: C.gray[100] },
  dishName:    { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1, marginRight: 8 },
  speedBadge:  { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeBox:     { alignItems: 'center', backgroundColor: C.gray[50], borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  timeBoxTotal:{ backgroundColor: C.restaurant.light },
  timeValue:   { fontSize: 16, fontWeight: '800', color: C.gray[800] },
  timeLabel:   { fontSize: 10, color: C.gray[400], marginTop: 1 },
  plus:        { fontSize: 16, color: C.gray[400], fontWeight: '300' },
  staffMeta:   { fontSize: 11, color: C.gray[400], marginTop: 6 },
  empty:       { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  cancelText:  { fontSize: 16, color: C.gray[500] },
  label:       { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:       { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:   { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:     { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
