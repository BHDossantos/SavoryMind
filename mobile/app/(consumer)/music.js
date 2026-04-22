import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const MOODS = ['Happy', 'Romantic', 'Relaxed', 'Energetic', 'Cozy', 'Adventurous', 'Melancholic', 'Celebratory'];
const CUISINES = ['Italian', 'Japanese', 'Mexican', 'French', 'Indian', 'American', 'Mediterranean', 'Thai'];

export default function MusicScreen() {
  const [mood, setMood] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = async () => {
    try { const data = await api.getMusicMoods(); setHistory(data.slice(0, 5)); } catch {}
    finally { setHistLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const handleGenerate = async () => {
    if (!mood) { setError('Pick a mood first.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await api.createMusicMood({ mood, cuisine: cuisine || 'Any', dish: '' });
      setResult(data);
      loadHistory();
    } catch (e) { setError(e.message || 'Could not generate mood.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Music Mood</Text>
        <Text style={styles.sub}>Set the soundtrack for your meal</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>How are you feeling?</Text>
        <View style={styles.chipGrid}>
          {MOODS.map((m) => (
            <TouchableOpacity key={m} style={[styles.chip, mood === m && styles.chipActive]} onPress={() => { setMood(m); setError(null); }}>
              <Text style={[styles.chipText, mood === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Cuisine vibe? (optional)</Text>
        <View style={styles.chipGrid}>
          {CUISINES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, cuisine === c && styles.chipActive]} onPress={() => setCuisine(cuisine === c ? '' : c)}>
              <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading || !mood}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generate My Soundtrack 🎵</Text>}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeading}>{result.mood} · {result.cuisine}</Text>
            <View style={styles.resultRow}><Text style={styles.rrLabel}>Genre</Text><Text style={styles.rrValue}>{result.genre_recommendation}</Text></View>
            {result.artist_suggestions?.length > 0 && <View style={styles.resultRow}><Text style={styles.rrLabel}>Artists</Text><Text style={styles.rrValue}>{result.artist_suggestions.join(', ')}</Text></View>}
            {result.playlist_name && <View style={styles.resultRow}><Text style={styles.rrLabel}>Playlist</Text><Text style={styles.rrValue}>{result.playlist_name}</Text></View>}
            {result.tempo && <View style={styles.resultRow}><Text style={styles.rrLabel}>Tempo</Text><Text style={styles.rrValue}>{result.tempo}</Text></View>}
          </View>
        )}

        {history.length > 0 && (
          <>
            <Text style={styles.histTitle}>Your recent moods</Text>
            {history.map((h, i) => (
              <View key={i} style={styles.histCard}>
                <Text style={styles.histMood}>{h.mood} · {h.cuisine}</Text>
                <Text style={styles.histGenre}>{h.genre_recommendation}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:          { padding: 16, paddingTop: 56 },
  title:           { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:             { fontSize: 13, color: C.gray[500], marginTop: 2 },
  label:           { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 10, marginTop: 4 },
  chipGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray[200], backgroundColor: '#fff' },
  chipActive:      { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  chipText:        { fontSize: 13, color: C.gray[600], fontWeight: '500' },
  chipTextActive:  { color: C.consumer.primary, fontWeight: '700' },
  error:           { color: C.red, fontSize: 13, marginBottom: 12 },
  generateBtn:     { backgroundColor: C.consumer.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.consumer.border, marginBottom: 20 },
  resultHeading:   { fontSize: 15, fontWeight: '800', color: C.consumer.text, marginBottom: 12 },
  resultRow:       { marginBottom: 10 },
  rrLabel:         { fontSize: 11, fontWeight: '600', color: C.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  rrValue:         { fontSize: 14, color: C.gray[800], lineHeight: 20 },
  histTitle:       { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10 },
  histCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  histMood:        { fontSize: 13, fontWeight: '600', color: C.gray[800] },
  histGenre:       { fontSize: 12, color: C.gray[500], marginTop: 3 },
});
