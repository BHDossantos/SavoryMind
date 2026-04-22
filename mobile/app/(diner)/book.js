import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const EMPTY = { restaurant_name: '', date: '', time: '', party_size: '2', special_requests: '' };

export default function BookScreen() {
  const [bookings, setBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { const data = await api.getDinerBookings(); setBookings(data); } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormError(null); };

  const handleBook = async () => {
    if (!form.restaurant_name.trim() || !form.date.trim() || !form.time.trim()) {
      setFormError('Restaurant name, date, and time are required.'); return;
    }
    setSaving(true); setFormError(null);
    try {
      await api.createDinerBooking({ ...form, party_size: parseInt(form.party_size) || 2 });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Booking failed.'); }
    finally { setSaving(false); }
  };

  const handleCancel = (b) =>
    Alert.alert('Cancel Booking', `Cancel your booking at ${b.restaurant_name}?`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => { await api.cancelDinerBooking(b.id); load(); } },
    ]);

  const upcoming = bookings.filter((b) => b.status !== 'cancelled');
  const past = bookings.filter((b) => b.status === 'cancelled');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>My Bookings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Book'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Booking</Text>
            {[
              { key: 'restaurant_name', label: 'Restaurant Name', placeholder: 'e.g. The Oak Room' },
              { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
              { key: 'time', label: 'Time', placeholder: 'e.g. 19:30' },
              { key: 'party_size', label: 'Party Size', placeholder: '2', kb: 'number-pad' },
              { key: 'special_requests', label: 'Special Requests (optional)', placeholder: 'Allergies, preferences...' },
            ].map(({ key, label, placeholder, kb }) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <Text style={styles.label}>{label}</Text>
                <TextInput style={styles.input} value={form[key]} onChangeText={(v) => set(key, v)} placeholder={placeholder} keyboardType={kb || 'default'} />
              </View>
            ))}
            {formError && <Text style={styles.formError}>{formError}</Text>}
            <TouchableOpacity style={styles.saveBtn} onPress={handleBook} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirm Booking</Text>}
            </TouchableOpacity>
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcoming.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.restaurant}>{b.restaurant_name}</Text>
                  <Text style={styles.bookingMeta}>{b.date} at {b.time} · {b.party_size} guests</Text>
                  {b.special_requests && <Text style={styles.requests}>"{b.special_requests}"</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <View style={[styles.badge, { backgroundColor: b.status === 'confirmed' ? '#dcfce7' : '#fef3c7' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: b.status === 'confirmed' ? '#16a34a' : '#d97706' }}>{b.status}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleCancel(b)}>
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {upcoming.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No upcoming bookings</Text>
            <Text style={styles.emptySub}>Tap "+ Book" to reserve your next table</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  addBtn:      { backgroundColor: C.diner.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  formCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  formTitle:   { fontSize: 16, fontWeight: '800', color: C.gray[900], marginBottom: 14 },
  label:       { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:       { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:   { color: C.red, fontSize: 13, marginBottom: 8 },
  saveBtn:     { backgroundColor: C.diner.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10 },
  bookingCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  restaurant:  { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  bookingMeta: { fontSize: 13, color: C.gray[500], marginTop: 3 },
  requests:    { fontSize: 12, color: C.gray[400], marginTop: 4, fontStyle: 'italic' },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cancelLink:  { fontSize: 12, color: C.red },
  empty:       { alignItems: 'center', marginTop: 40 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { fontSize: 17, fontWeight: '700', color: C.gray[700] },
  emptySub:    { fontSize: 13, color: C.gray[500], marginTop: 6, textAlign: 'center' },
});
