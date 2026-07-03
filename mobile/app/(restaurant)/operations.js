import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const CAT_ICON = { general: '📋', opening: '🌅', closing: '🌙', prep: '🔪', compliance: '🛡️', maintenance: '🔧' };

export default function OperationsScreen() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [tk, cl] = await Promise.all([api.getOpsTasks(), api.getChecklists()]);
      setTasks(tk); setChecklists(cl); setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try { await api.createOpsTask({ title: title.trim() }); setTitle(''); load(); }
    catch (e) { Alert.alert(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const toggle = async (tk) => { try { await api.toggleOpsTask(tk.id, !tk.done); load(); } catch {} };
  const remove = (tk) => Alert.alert('Delete', `Delete "${tk.title}"?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteOpsTask(tk.id); load(); } },
  ]);
  const runChecklist = async (c) => { setBusy(true); try { await api.instantiateChecklist(c.id); load(); } catch (e) { Alert.alert(e.message || 'Failed'); } finally { setBusy(false); } };

  if (loading) return <LoadingSpinner message="Loading operations..." color={C.restaurant.primary} />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('opsPage.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {tasks.overdue_count > 0 && (
          <View style={styles.overdue}>
            <Text style={styles.overdueText}>⚠️ {t('opsPage.overdue', { count: tasks.overdue_count })}</Text>
          </View>
        )}

        {checklists.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.section}>{t('opsPage.checklists')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {checklists.map((c) => (
                <TouchableOpacity key={c.id} style={styles.chip} onPress={() => runChecklist(c)} disabled={busy}>
                  <Text style={styles.chipText}>{CAT_ICON[c.category] || '📋'} {c.name} · {t('opsPage.runToday')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.addRow}>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('opsPage.taskPh')} onSubmitEditing={add} />
          <TouchableOpacity style={styles.addBtn} onPress={add} disabled={busy}>
            <Text style={styles.addBtnText}>{t('opsPage.addTask')}</Text>
          </TouchableOpacity>
        </View>

        {tasks.open.length === 0 && tasks.done.length === 0 && (
          <Text style={styles.empty}>{t('opsPage.allClear')}</Text>
        )}
        {[...tasks.open, ...tasks.done].map((tk) => (
          <View key={tk.id} style={styles.task}>
            <TouchableOpacity onPress={() => toggle(tk)} style={[styles.check, tk.done && styles.checkOn]}>
              {tk.done && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <Text style={[styles.taskText, tk.done && styles.taskDone]}>
              {CAT_ICON[tk.category] || '📋'} {tk.title}
            </Text>
            {tk.due_date ? <Text style={styles.due}>{tk.due_date}</Text> : null}
            <TouchableOpacity onPress={() => remove(tk)}><Text>🗑️</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:   { padding: 16, paddingTop: 56 },
  title:    { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  overdue:  { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  overdueText: { fontSize: 13, color: '#b45309', fontWeight: '600' },
  section:  { fontSize: 13, fontWeight: '700', color: C.gray[700], marginBottom: 8 },
  chip:     { backgroundColor: '#fff', borderColor: C.gray[200], borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '600', color: C.restaurant.text },
  addRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:    { flex: 1, borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  addBtn:   { backgroundColor: C.restaurant.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:    { textAlign: 'center', color: C.gray[400], marginTop: 30, fontSize: 14 },
  task:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.gray[100], paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  check:    { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: C.gray[300], alignItems: 'center', justifyContent: 'center' },
  checkOn:  { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkMark:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  taskText: { flex: 1, fontSize: 14, color: C.gray[900] },
  taskDone: { textDecorationLine: 'line-through', color: C.gray[400] },
  due:      { fontSize: 11, color: C.gray[400] },
});
