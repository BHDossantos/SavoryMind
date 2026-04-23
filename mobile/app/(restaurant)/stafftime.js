import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const EMPTY = { staff_name: '', date: '', clock_in: '', clock_out: '', break_minutes: '0', notes: '' };

function HoursBadge({ hours }) {
  const overtime = hours > 8, short = hours < 4;
  const color = overtime ? C.red : short ? C.amber : C.green;
  const label = overtime ? 'Overtime' : short ? 'Short' : 'Regular';
  return <Text style={[styles.badge, { color, borderColor: color }]}>{label}</Text>;
}

export default function StaffTimeScreen() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { setLogs(await api.getStaffTimeLogs()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.staff_name.trim()) { setFormError('Staff name is required.'); return; }
    if (!form.date.match(/^\d{4}-\d{2}-\d{2}$/)) { setFormError('Date must be YYYY-MM-DD.'); return; }
    if (!form.clock_in.match(/^\d{2}:\d{2}$/)) { setFormError('Clock-in must be HH:MM.'); return; }
    if (!form.clock_out.match(/^\d{2}:\d{2}$/)) { setFormError('Clock-out must be HH:MM.'); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createStaffTimeLog({ ...form, break_minutes: parseInt(form.break_minutes) || 0 });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (log) => Alert.alert('Delete Record', `Remove time log for ${log.staff_name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteStaffTimeLog(log.id); load(); } },
  ]);

  if (loading) return <LoadingSpinner message="Loading staff times..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const totalHours = logs.reduce((s, l) => s + l.total_hours, 0);
  const overtimeCount = logs.filter(l => l.total_hours > 8).length;

  const byStaff = logs.reduce((acc, l) => {
    if (!acc[l.staff_name]) acc[l.staff_name] = { hours: 0, shifts: 0 };
    acc[l.staff_name].hours += l.total_hours;
    acc[l.staff_name].shifts++;
    return acc;
  }, {});
  const topStaff = Object.entries(byStaff).sort((a, b) => b[1].hours - a[1].hours)[0];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Staff Time</Text>
          <Text style={styles.sub}>{logs.length} shifts · {totalHours.toFixed(1)}h total</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {/* Summary metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{logs.length}</Text>
          <Text style={styles.metricLbl}>Shifts</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{logs.length ? (totalHours / logs.length).toFixed(1) : '—'}</Text>
          <Text style={styles.metricLbl}>Avg Hrs</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricVal, overtimeCount > 0 && { color: C.red }]}>{overtimeCount}</Text>
          <Text style={styles.metricLbl}>Overtime</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{Object.keys(byStaff).length}</Text>
          <Text style={styles.metricLbl}>Staff</Text>
        </View>
      </View>

      {topStaff && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertIcon}>🏆</Text>
          <View>
            <Text style={styles.alertTitle}>Most hours: {topStaff[0]}</Text>
            <Text style={styles.alertSub}>{topStaff[1].hours.toFixed(1)}h across {topStaff[1].shifts} shifts</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {logs.map(log => (
          <View key={log.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.staffName}>{log.staff_name}</Text>
                <HoursBadge hours={log.total_hours} />
              </View>
              <View style={styles.timeRow}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeValue}>{log.clock_in}</Text>
                  <Text style={styles.timeLabel}>In</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
                <View style={styles.timeBox}>
                  <Text style={styles.timeValue}>{log.clock_out}</Text>
                  <Text style={styles.timeLabel}>Out</Text>
                </View>
                <View style={[styles.timeBox, styles.timeBoxTotal]}>
                  <Text style={[styles.timeValue, { color: C.restaurant.primary }]}>{log.total_hours.toFixed(1)}h</Text>
                  <Text style={styles.timeLabel}>Total</Text>
                </View>
              </View>
              <Text style={styles.meta}>📅 {log.date}{log.break_minutes > 0 ? ` · ${log.break_minutes}m break` : ''}</Text>
              {log.notes ? <Text style={styles.notes}>{log.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => handleDelete(log)} style={{ padding: 4, alignSelf: 'flex-start' }}>
              <Text>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
        {logs.length === 0 && <Text style={styles.empty}>No shifts logged yet. Tap + Log to start.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Shift</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {[
              { key: 'staff_name',    label: 'Staff Name *' },
              { key: 'date',          label: 'Date * (YYYY-MM-DD)', kb: 'default' },
              { key: 'clock_in',      label: 'Clock In * (HH:MM)', kb: 'default' },
              { key: 'clock_out',     label: 'Clock Out * (HH:MM)', kb: 'default' },
              { key: 'break_minutes', label: 'Break (minutes)', kb: 'number-pad' },
              { key: 'notes',         label: 'Notes' },
            ].map(({ key, label, kb }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={v => set(key, v)}
                  keyboardType={kb || 'default'}
                  placeholder={key === 'date' ? new Date().toISOString().slice(0, 10) : key === 'clock_in' ? '09:00' : key === 'clock_out' ? '17:00' : ''}
                  placeholderTextColor={C.gray[400]}
                />
              </View>
            ))}
            {formError && <Text style={styles.formError}>{formError}</Text>}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Shift</Text>}
            </TouchableOpacity>
          </ScrollView>
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
  metricsRow:  { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  metric:      { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.gray[100] },
  metricVal:   { fontSize: 20, fontWeight: '800', color: C.restaurant.primary },
  metricLbl:   { fontSize: 10, color: C.gray[500], marginTop: 2 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 12, marginHorizontal: 16, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#bbf7d0' },
  alertIcon:   { fontSize: 22 },
  alertTitle:  { fontSize: 13, fontWeight: '700', color: '#166534' },
  alertSub:    { fontSize: 11, color: '#16a34a', marginTop: 1 },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: C.gray[100] },
  staffName:   { fontSize: 15, fontWeight: '700', color: C.gray[900], flex: 1 },
  badge:       { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeBox:     { alignItems: 'center', backgroundColor: C.gray[50], borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  timeBoxTotal:{ backgroundColor: C.restaurant.light },
  timeValue:   { fontSize: 15, fontWeight: '800', color: C.gray[800] },
  timeLabel:   { fontSize: 10, color: C.gray[400], marginTop: 1 },
  arrow:       { fontSize: 16, color: C.gray[400] },
  meta:        { fontSize: 11, color: C.gray[400], marginTop: 6 },
  notes:       { fontSize: 11, color: C.gray[500], marginTop: 3, fontStyle: 'italic' },
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
