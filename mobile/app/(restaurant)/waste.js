import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const REASONS = ['Over-portioned', 'Cooking error', 'Spoilage', 'Over-ordered', 'Plate return', 'Other'];
const EMPTY = { item_name: '', quantity_kg: '', estimated_cost: '', reason: 'Spoilage', staff_name: '', notes: '' };

export default function WasteScreen() {
  const { t } = useTranslation();
  const [logs, setLogs]           = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try {
      const [l, s] = await Promise.all([api.getWasteLogs(), api.getWasteSummary()]);
      setLogs(l); setSummary(s); setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.item_name.trim()) { setFormError('Item name is required.'); return; }
    const qty  = parseFloat(form.quantity_kg);
    const cost = parseFloat(form.estimated_cost);
    if (isNaN(qty) || qty <= 0) { setFormError('Quantity must be > 0.'); return; }
    if (isNaN(cost) || cost < 0) { setFormError('Cost cannot be negative.'); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createWasteLog({ ...form, quantity_kg: qty, estimated_cost: cost });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (log) => Alert.alert('Delete Entry', `Remove waste log for ${log.item_name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteWasteLog(log.id); load(); } },
  ]);

  if (loading) return <LoadingSpinner message="Loading waste log..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t('screens.waste.title')}</Text>
          {summary && <Text style={styles.sub}>${summary.total_cost.toFixed(2)} total · {summary.total_kg.toFixed(1)} kg</Text>}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {summary && summary.by_staff?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffRow}>
          {summary.by_staff.map(s => (
            <View key={s.name} style={styles.staffCard}>
              <Text style={styles.staffName}>{s.name.split(' ')[0]}</Text>
              <Text style={styles.staffCost}>${s.total_cost.toFixed(0)}</Text>
              <Text style={styles.staffInc}>{s.incidents} incidents</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {logs.map(log => (
          <View key={log.id} style={styles.card}>
            <View style={styles.costBadge}>
              <Text style={styles.costText}>${log.estimated_cost.toFixed(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{log.item_name}</Text>
              <Text style={styles.meta}>{log.quantity_kg} kg · {log.reason}</Text>
              <Text style={styles.meta}>{log.date}{log.staff_name ? ` · ${log.staff_name}` : ''}</Text>
              {log.notes ? <Text style={styles.note}>{log.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => handleDelete(log)} style={{ padding: 4, alignSelf: 'flex-start' }}>
              <Text>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
        {logs.length === 0 && <Text style={styles.empty}>No waste logs yet. Great job!</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Waste</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>

          {[
            { key: 'item_name', label: 'Item Name *' },
            { key: 'quantity_kg', label: 'Quantity (kg) *', kb: 'decimal-pad' },
            { key: 'estimated_cost', label: 'Estimated Cost ($) *', kb: 'decimal-pad' },
            { key: 'staff_name', label: 'Staff Member' },
            { key: 'notes', label: 'Notes' },
          ].map(({ key, label, kb }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={form[key]} onChangeText={v => set(key, v)} keyboardType={kb || 'default'} />
            </View>
          ))}

          <Text style={styles.label}>Reason</Text>
          <View style={styles.reasonGrid}>
            {REASONS.map(r => (
              <TouchableOpacity key={r} style={[styles.reasonBtn, form.reason === r && styles.reasonBtnActive]} onPress={() => set('reason', r)}>
                <Text style={[styles.reasonText, form.reason === r && styles.reasonTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:           { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:             { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:          { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  staffRow:        { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  staffCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', minWidth: 90, borderWidth: 1, borderColor: C.gray[100] },
  staffName:       { fontSize: 13, fontWeight: '700', color: C.gray[800] },
  staffCost:       { fontSize: 16, fontWeight: '800', color: C.red, marginTop: 2 },
  staffInc:        { fontSize: 10, color: C.gray[400], marginTop: 2 },
  card:            { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: C.gray[100] },
  costBadge:       { backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  costText:        { fontSize: 15, fontWeight: '800', color: C.red },
  itemName:        { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  meta:            { fontSize: 12, color: C.gray[500], marginTop: 2 },
  note:            { fontSize: 11, color: C.gray[400], marginTop: 3, fontStyle: 'italic' },
  empty:           { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  cancelText:      { fontSize: 16, color: C.gray[500] },
  label:           { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:           { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50], marginBottom: 12 },
  reasonGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  reasonBtn:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  reasonBtnActive: { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  reasonText:      { fontSize: 13, color: C.gray[600] },
  reasonTextActive:{ color: '#fff', fontWeight: '700' },
  formError:       { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:         { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});
