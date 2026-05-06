import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const MOODS = ['🥰', '😊', '😋', '🤤', '😐', '😩'];

export default function JournalScreen() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ dish_name: '', notes: '', mood: '😋' });

  const load = async () => {
    try { setMemories(await api.getMemories()); }
    catch {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleSave = async () => {
    if (!form.dish_name.trim()) return;
    setSaving(true);
    try {
      const m = await api.createMemory({
        dish_name: form.dish_name.trim(),
        notes:     form.notes.trim() || null,
        mood:      form.mood,
      });
      setMemories((prev) => [m, ...prev]);
      setForm({ dish_name: '', notes: '', mood: '😋' });
      setShowForm(false);
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete memory?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        await api.deleteMemory(id).catch(() => load());
      }},
    ]);
  };

  if (loading) return (
    <SafeScreen><View style={{ padding: 24 }}><ActivityIndicator color={C.consumer.primary} /></View></SafeScreen>
  );

  return (
    <SafeScreen onRefresh={load}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>📓 Meal Journal</Text>
          <Text style={styles.sub}>Remember the great ones, learn from the misses</Text>
        </View>
        <TouchableOpacity onPress={() => setShowForm(!showForm)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Log meal'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={form.dish_name}
            onChangeText={(t) => setForm((f) => ({ ...f, dish_name: t }))}
            placeholder="What did you make / eat?"
            placeholderTextColor={C.gray[400]}
          />
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 8 }]}
            value={form.notes}
            onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
            placeholder="Notes — what worked, what to change next time"
            placeholderTextColor={C.gray[400]}
            multiline
          />
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setForm((f) => ({ ...f, mood: m }))}
                style={[styles.moodChip, form.mood === m && styles.moodChipActive]}
              >
                <Text style={styles.moodEmoji}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!form.dish_name.trim() || saving}
            style={[styles.saveBtn, (!form.dish_name.trim() || saving) && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save memory'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {memories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📓</Text>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptySub}>Log a meal to start building your taste memory.</Text>
        </View>
      ) : (
        memories.map((m) => (
          <View key={m.id} style={styles.memCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.memMood}>{m.mood || '😋'}</Text>
                <Text style={styles.memName}>{m.dish_name}</Text>
              </View>
              {m.notes && <Text style={styles.memNotes}>{m.notes}</Text>}
              {m.created_at && (
                <Text style={styles.memDate}>{new Date(m.created_at).toLocaleDateString()}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => handleDelete(m.id)} hitSlop={10}>
              <Text style={styles.memDelete}>✕</Text>
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
  addBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.consumer.primary },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  form:          { marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.consumer.border },
  input:         { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, padding: 10, fontSize: 14, color: C.gray[900], backgroundColor: C.gray[50] },
  moodRow:       { flexDirection: 'row', gap: 6, marginTop: 10 },
  moodChip:      { padding: 8, borderRadius: 999, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  moodChipActive:{ borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  moodEmoji:     { fontSize: 18 },
  saveBtn:       { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: C.consumer.primary, alignItems: 'center' },
  saveBtnDisabled:{ backgroundColor: C.gray[300] },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:         { padding: 32, alignItems: 'center' },
  emptyEmoji:    { fontSize: 36, marginBottom: 6 },
  emptyTitle:    { fontSize: 15, fontWeight: '700', color: C.gray[800] },
  emptySub:      { fontSize: 12, color: C.gray[500], marginTop: 4, textAlign: 'center' },
  memCard:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.gray[100] },
  memMood:       { fontSize: 18 },
  memName:       { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  memNotes:      { fontSize: 13, color: C.gray[700], marginTop: 6, lineHeight: 18 },
  memDate:       { fontSize: 11, color: C.gray[400], marginTop: 6 },
  memDelete:     { fontSize: 16, color: C.gray[400], paddingLeft: 8 },
});
