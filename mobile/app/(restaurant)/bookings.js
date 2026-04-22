import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const STATUSES = ['All', 'confirmed', 'completed', 'cancelled'];
const STATUS_COLOR = { confirmed: C.green, completed: C.gray[400], cancelled: C.red };
const EMPTY = { customer_name: '', customer_email: '', customer_phone: '', date: '', time_slot: '', party_size: '2', table_number: '', notes: '' };

function Badge({ label, color }) {
  return <Text style={[styles.badge, { color, borderColor: color }]}>{label}</Text>;
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { const d = await api.getBookings(); setBookings(d); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const today = new Date().toISOString().slice(0, 10);
  const todayConfirmed = bookings.filter(b => b.date === today && b.status === 'confirmed');
  const covers = todayConfirmed.reduce((s, b) => s + b.party_size, 0);
  const filtered = bookings.filter(b => filter === 'All' || b.status === filter);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.customer_name.trim()) { setFormError('Guest name is required.'); return; }
    if (!form.date.match(/^\d{4}-\d{2}-\d{2}$/)) { setFormError('Date format: YYYY-MM-DD'); return; }
    if (!form.time_slot.trim()) { setFormError('Time is required (e.g. 19:00).'); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createBooking({ ...form, party_size: parseInt(form.party_size) || 2, table_number: form.table_number ? parseInt(form.table_number) : null });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (b) => Alert.alert('Delete Booking', `Remove booking for ${b.customer_name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteBooking(b.id); load(); } },
  ]);

  if (loading) return <LoadingSpinner message="Loading bookings..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Bookings</Text>
          <Text style={styles.sub}>Today: {todayConfirmed.length} bookings · {covers} covers</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUSES.map(s => (
          <TouchableOpacity key={s} style={[styles.pill, filter === s && styles.pillActive]} onPress={() => setFilter(s)}>
            <Text style={[styles.pillText, filter === s && styles.pillTextActive]}>
              {s === 'All' ? 'All' : s[0].toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filtered.map(b => (
          <View key={b.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.name}>{b.customer_name}</Text>
                <Badge label={b.status} color={STATUS_COLOR[b.status] || C.gray[400]} />
              </View>
              <Text style={styles.meta}>{b.date} · {b.time_slot} · {b.party_size} guests{b.table_number ? ` · Table ${b.table_number}` : ''}</Text>
              {b.notes ? <Text style={styles.note}>{b.notes}</Text> : null}
              {b.customer_email ? <Text style={styles.contact}>{b.customer_email}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => handleDelete(b)} style={{ padding: 4, alignSelf: 'flex-start' }}>
              <Text>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>No bookings found.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Booking</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
          {[
            { key: 'customer_name', label: 'Guest Name *' },
            { key: 'customer_email', label: 'Email' },
            { key: 'customer_phone', label: 'Phone' },
            { key: 'date', label: 'Date * (YYYY-MM-DD)' },
            { key: 'time_slot', label: 'Time * (e.g. 19:00)' },
            { key: 'party_size', label: 'Party Size', kb: 'number-pad' },
            { key: 'table_number', label: 'Table Number', kb: 'number-pad' },
            { key: 'notes', label: 'Notes / Special Requests' },
          ].map(({ key, label, kb }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={form[key]} onChangeText={v => set(key, v)} keyboardType={kb || 'default'} />
            </View>
          ))}
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Booking</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:          { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:       { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterRow:    { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  pill:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  pillActive:   { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  pillText:     { fontSize: 13, color: C.gray[600], fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', borderWidth: 1, borderColor: C.gray[100] },
  name:         { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1, marginRight: 8 },
  badge:        { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  meta:         { fontSize: 12, color: C.gray[500] },
  note:         { fontSize: 12, color: C.gray[600], marginTop: 4, fontStyle: 'italic' },
  contact:      { fontSize: 11, color: C.gray[400], marginTop: 2 },
  empty:        { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  cancelText:   { fontSize: 16, color: C.gray[500] },
  label:        { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:    { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:      { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
});
