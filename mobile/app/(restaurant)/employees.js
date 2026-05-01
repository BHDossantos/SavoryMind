import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const ROLES = ['waiter', 'chef', 'sommelier', 'manager', 'host'];

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', display_name: '', role: 'waiter',
  });

  const load = async () => {
    try { setEmployees(await api.getEmployees()); }
    catch {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleCreate = async () => {
    if (!form.email.trim() || !form.password || !form.display_name.trim()) {
      Alert.alert('Missing fields', 'Email, password, and name are required.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Password too short', 'Min 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.createEmployee({
        email: form.email.trim(), password: form.password,
        display_name: form.display_name.trim(), role: form.role,
      });
      setForm({ email: '', password: '', display_name: '', role: 'waiter' });
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('Could not create', e.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (emp) => {
    Alert.alert(`Remove ${emp.display_name}?`, 'They lose access to the staff portal immediately.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await api.deleteEmployee(emp.id).catch(() => {});
        load();
      }},
    ]);
  };

  if (loading) return (
    <SafeScreen><View style={{ padding: 24 }}><ActivityIndicator color={C.restaurant.primary} /></View></SafeScreen>
  );

  return (
    <SafeScreen onRefresh={load}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>👥 Employees</Text>
          <Text style={styles.sub}>Staff accounts for the time-clock + portal</Text>
        </View>
        <TouchableOpacity onPress={() => setShowForm(!showForm)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={form.display_name}
            onChangeText={(t) => setForm((f) => ({ ...f, display_name: t }))}
            placeholder="Full name"
            placeholderTextColor={C.gray[400]}
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={form.email}
            onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
            placeholder="email@example.com"
            placeholderTextColor={C.gray[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={form.password}
            onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
            placeholder="Initial password (min 6 chars)"
            placeholderTextColor={C.gray[400]}
            secureTextEntry
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setForm((f) => ({ ...f, role: r }))}
                style={[styles.roleChip, form.role === r && styles.roleChipActive]}
              >
                <Text style={[styles.roleText, form.role === r && styles.roleTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={saving}
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Creating…' : 'Create employee'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {employees.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No employees yet</Text>
          <Text style={styles.emptySub}>Create accounts so staff can clock in/out.</Text>
        </View>
      ) : (
        employees.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{e.display_name}</Text>
              <Text style={styles.rowMeta}>{e.email} · <Text style={{ textTransform: 'capitalize' }}>{e.role || 'staff'}</Text></Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(e)} hitSlop={10}>
              <Text style={styles.rowDelete}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header:        { padding: 16, flexDirection: 'row', alignItems: 'flex-end' },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:           { fontSize: 13, color: C.gray[500], marginTop: 2 },
  addBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.restaurant.primary },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  form:          { marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.restaurant.border },
  input:         { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, padding: 10, fontSize: 14, color: C.gray[900], backgroundColor: C.gray[50] },
  roleChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.gray[200], marginRight: 6, backgroundColor: '#fff' },
  roleChipActive:{ borderColor: C.restaurant.primary, backgroundColor: C.restaurant.light },
  roleText:      { fontSize: 12, color: C.gray[600], textTransform: 'capitalize' },
  roleTextActive:{ color: C.restaurant.text, fontWeight: '700' },
  saveBtn:       { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: C.restaurant.primary, alignItems: 'center' },
  saveBtnDisabled:{ backgroundColor: C.gray[300] },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:         { padding: 32, alignItems: 'center' },
  emptyEmoji:    { fontSize: 36, marginBottom: 6 },
  emptyTitle:    { fontSize: 15, fontWeight: '700', color: C.gray[800] },
  emptySub:      { fontSize: 12, color: C.gray[500], marginTop: 4, textAlign: 'center' },
  row:           { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.gray[100] },
  rowName:       { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  rowMeta:       { fontSize: 12, color: C.gray[500], marginTop: 2 },
  rowDelete:     { fontSize: 16, color: C.gray[400] },
});
