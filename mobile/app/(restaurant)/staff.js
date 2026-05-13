import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const ROLES  = ['chef', 'server', 'host', 'manager', 'bartender', 'kitchen'];
const SHIFTS = ['morning', 'evening', 'full'];
const EMPTY  = { name: '', role: 'server', shift: 'full', hire_date: '', notes: '' };

const ROLE_EMOJI = { chef: '👨‍🍳', server: '🍽️', host: '🤝', manager: '📋', bartender: '🍸', kitchen: '🔪' };

function RatingBar({ value, max = 5 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 4.5 ? C.green : value >= 3.5 ? C.amber : C.red;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.ratingText, { color }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

export default function StaffScreen() {
  const { t } = useTranslation();
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { setStaff(await api.getStaff()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true); setFormError(null);
    try { await api.createStaff(form); setShowForm(false); setForm(EMPTY); load(); }
    catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (s) => Alert.alert('Remove Staff', `Remove ${s.name} from the team?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteStaff(s.id); load(); } },
  ]);

  if (loading) return <LoadingSpinner message="Loading staff..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const avgRating = staff.length ? (staff.reduce((s, m) => s + m.rating, 0) / staff.length).toFixed(1) : '—';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t('screens.staff.title')}</Text>
          <Text style={styles.sub}>{staff.length} members · avg rating {avgRating}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {staff.map(m => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.emoji}>{ROLE_EMOJI[m.role] || '👤'}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.roleTag}>{m.role} · {m.shift}</Text>
              </View>
              <View style={{ marginTop: 6 }}>
                <Text style={styles.ratingLabel}>Rating</Text>
                <RatingBar value={m.rating} />
              </View>
              <View style={styles.statRow}>
                <Text style={styles.stat}>🎯 {m.punctuality_score?.toFixed(0) ?? '—'}% punctual</Text>
                {m.orders_handled > 0 && <Text style={styles.stat}>📦 {m.orders_handled} orders</Text>}
              </View>
              {m.notes ? <Text style={styles.notes}>{m.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => handleDelete(m)} style={{ padding: 4, alignSelf: 'flex-start' }}>
              <Text>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
        {staff.length === 0 && <Text style={styles.empty}>No staff added yet.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>

          <Text style={styles.label}>Name *</Text>
          <TextInput style={[styles.input, { marginBottom: 12 }]} value={form.name} onChangeText={v => set('name', v)} placeholder="Full name" />

          <Text style={styles.label}>Role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {ROLES.map(r => (
              <TouchableOpacity key={r} style={[styles.pill, form.role === r && styles.pillActive]} onPress={() => set('role', r)}>
                <Text style={[styles.pillText, form.role === r && styles.pillTextActive]}>{ROLE_EMOJI[r]} {r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Shift</Text>
          <View style={styles.shiftRow}>
            {SHIFTS.map(s => (
              <TouchableOpacity key={s} style={[styles.shiftBtn, form.shift === s && styles.shiftBtnActive]} onPress={() => set('shift', s)}>
                <Text style={[styles.shiftText, form.shift === s && styles.shiftTextActive]}>{s[0].toUpperCase() + s.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Hire Date (YYYY-MM-DD)</Text>
          <TextInput style={[styles.input, { marginBottom: 12 }]} value={form.hire_date} onChangeText={v => set('hire_date', v)} placeholder="2024-01-15" />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, { marginBottom: 16, minHeight: 70 }]} value={form.notes} onChangeText={v => set('notes', v)} multiline placeholder="Any additional notes..." />

          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Staff Member</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:          { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:            { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:         { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: C.gray[100] },
  emoji:          { fontSize: 28, lineHeight: 34 },
  name:           { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  roleTag:        { fontSize: 11, color: C.gray[500] },
  ratingLabel:    { fontSize: 11, color: C.gray[400], marginBottom: 3 },
  barTrack:       { flex: 1, height: 6, backgroundColor: C.gray[100], borderRadius: 3, overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: 3 },
  ratingText:     { fontSize: 12, fontWeight: '700', width: 28 },
  statRow:        { flexDirection: 'row', gap: 12, marginTop: 6 },
  stat:           { fontSize: 11, color: C.gray[500] },
  notes:          { fontSize: 11, color: C.gray[400], marginTop: 4, fontStyle: 'italic' },
  empty:          { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  cancelText:     { fontSize: 16, color: C.gray[500] },
  label:          { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:          { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  pill:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], marginRight: 8, backgroundColor: '#fff' },
  pillActive:     { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  pillText:       { fontSize: 13, color: C.gray[600] },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  shiftRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  shiftBtn:       { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.gray[200], alignItems: 'center', backgroundColor: '#fff' },
  shiftBtnActive: { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  shiftText:      { fontSize: 13, color: C.gray[600], fontWeight: '500' },
  shiftTextActive:{ color: '#fff', fontWeight: '700' },
  formError:      { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:        { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});
