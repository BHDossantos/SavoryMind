import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

const MOODS    = ['Happy', 'Romantic', 'Relaxed', 'Energetic', 'Cozy', 'Adventurous', 'Melancholic', 'Celebratory'];
const CUISINES = ['Italian', 'Japanese', 'Mexican', 'French', 'Indian', 'American', 'Mediterranean', 'Thai'];

const STREAMING = [
  { id: 'spotify',      label: 'Spotify',       emoji: '🎧', color: '#1DB954', url: (q) => `spotify:search:${encodeURIComponent(q)}` },
  { id: 'apple',        label: 'Apple Music',   emoji: '🎵', color: '#FC3C44', url: (q) => `music://search?term=${encodeURIComponent(q)}` },
  { id: 'amazon',       label: 'Amazon Music',  emoji: '🎶', color: '#00A8E1', url: (q) => `https://music.amazon.com/search/${encodeURIComponent(q)}` },
];

export default function MusicScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [mood, setMood]           = useState('');
  const [cuisine, setCuisine]     = useState('');
  const [result, setResult]       = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError]         = useState(null);
  // Real Spotify integration: when the user is connected, we replace the
  // generic deep-link buttons below the result card with actual playable
  // tracks pulled from /v1/search using the user's stored token.
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyTracks, setSpotifyTracks]   = useState(null);   // null = not yet attempted
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyAuthError, setSpotifyAuthError] = useState(false);

  const loadHistory = async () => {
    try { const data = await api.getMusicMoods(); setHistory(data.slice(0, 6)); } catch {}
    finally { setHistLoading(false); }
  };

  const refreshSpotifyConnectionState = async () => {
    try {
      const conns = await api.getConnections();
      setSpotifyConnected(!!conns.find((c) => c.platform === 'spotify' && c.connected));
    } catch {}
  };

  useFocusEffect(useCallback(() => {
    loadHistory();
    refreshSpotifyConnectionState();
  }, []));

  // After we get a music-mood result, fetch real tracks if connected.
  useEffect(() => {
    if (!result || !spotifyConnected) {
      setSpotifyTracks(null);
      setSpotifyAuthError(false);
      return;
    }
    // Compose a search query from the result. The backend doesn't yet
    // include the original web's `spotify_query` field on the mobile
    // response shape, so derive one from genre + mood.
    const query = [result.genre_recommendation, result.mood].filter(Boolean).join(' ').trim()
      || result.mood || 'dinner mood';

    let cancelled = false;
    setSpotifyLoading(true);
    setSpotifyAuthError(false);
    api.searchSpotify(query, 10)
      .then((data) => {
        if (cancelled) return;
        setSpotifyTracks(data.tracks || []);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err.message || '';
        if (msg.includes('Spotify session expired') || msg.includes('not connected') || msg.includes('rejected')) {
          setSpotifyAuthError(true);
        }
        setSpotifyTracks([]);
      })
      .finally(() => { if (!cancelled) setSpotifyLoading(false); });
    return () => { cancelled = true; };
  }, [result?.id, spotifyConnected]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const openStreaming = async (service, genre) => {
    const query = genre || mood;
    const url = service.url(query);
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (supported) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(service.url.toString().includes('amazon') ? url : `https://open.spotify.com/search/${encodeURIComponent(query)}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('screens.music.title')}</Text>
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

        <TouchableOpacity style={[styles.generateBtn, !mood && styles.generateBtnDisabled]} onPress={handleGenerate} disabled={loading || !mood}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generate My Soundtrack 🎵</Text>}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeading}>{result.mood} · {result.cuisine}</Text>
            <View style={styles.resultRow}><Text style={styles.rrLabel}>Genre</Text><Text style={styles.rrValue}>{result.genre_recommendation}</Text></View>
            {result.artist_suggestions?.length > 0 && (
              <View style={styles.resultRow}><Text style={styles.rrLabel}>Artists</Text><Text style={styles.rrValue}>{result.artist_suggestions.join(', ')}</Text></View>
            )}
            {result.playlist_name && (
              <View style={styles.resultRow}><Text style={styles.rrLabel}>Playlist</Text><Text style={styles.rrValue}>{result.playlist_name}</Text></View>
            )}
            {result.tempo && (
              <View style={styles.resultRow}><Text style={styles.rrLabel}>Tempo</Text><Text style={styles.rrValue}>{result.tempo}</Text></View>
            )}

            {/* Connected → real tracks via /v1/search; disconnected → the
                old emoji deep-link buttons. The connected branch is the
                whole point of the OAuth flow we shipped. */}
            {spotifyConnected ? (
              <View>
                <Text style={styles.streamLabel}>Top matches on your Spotify</Text>
                {spotifyAuthError ? (
                  <TouchableOpacity onPress={() => router.push('/(consumer)/social')} style={styles.reconnectBox}>
                    <Text style={styles.reconnectText}>Your Spotify session expired. Tap to reconnect.</Text>
                  </TouchableOpacity>
                ) : spotifyLoading ? (
                  <View style={{ paddingVertical: 14 }}>
                    <ActivityIndicator color="#1DB954" />
                  </View>
                ) : spotifyTracks && spotifyTracks.length > 0 ? (
                  spotifyTracks.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.trackRow}
                      onPress={() => t.external_url && Linking.openURL(t.external_url)}
                      activeOpacity={0.7}
                    >
                      {t.album_image
                        ? <Image source={{ uri: t.album_image }} style={styles.trackArt} />
                        : <View style={[styles.trackArt, { backgroundColor: C.gray[200] }]} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.trackName} numberOfLines={1}>{t.name}</Text>
                        <Text style={styles.trackArtists} numberOfLines={1}>{(t.artists || []).join(', ')}</Text>
                      </View>
                      <Text style={styles.trackOpen}>Open ↗</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.trackEmpty}>No tracks matched on your Spotify — try a different mood.</Text>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.streamLabel}>Play now on</Text>
                <View style={styles.streamRow}>
                  {STREAMING.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.streamBtn, { backgroundColor: s.color }]}
                      onPress={() => openStreaming(s, result.genre_recommendation)}
                    >
                      <Text style={styles.streamEmoji}>{s.emoji}</Text>
                      <Text style={styles.streamName}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => router.push('/(consumer)/social')} style={styles.connectBanner}>
                  <Text style={styles.connectBannerText}>🔗 Connect Spotify for real tracks instead of search links</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {history.length > 0 && (
          <>
            <Text style={styles.histTitle}>Your recent moods</Text>
            {history.map((h, i) => (
              <TouchableOpacity
                key={i}
                style={styles.histCard}
                onPress={() => { setMood(h.mood); setCuisine(h.cuisine !== 'Any' ? h.cuisine : ''); }}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.histMood}>{h.mood} · {h.cuisine}</Text>
                  <Text style={styles.histGenre}>{h.genre_recommendation}</Text>
                </View>
                <Text style={styles.reuse}>↩</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:             { padding: 16, paddingTop: 56 },
  title:              { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:                { fontSize: 13, color: C.gray[500], marginTop: 2 },
  label:              { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 10, marginTop: 4 },
  chipGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:               { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray[200], backgroundColor: '#fff' },
  chipActive:         { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  chipText:           { fontSize: 13, color: C.gray[600], fontWeight: '500' },
  chipTextActive:     { color: C.consumer.primary, fontWeight: '700' },
  error:              { color: C.red, fontSize: 13, marginBottom: 12 },
  generateBtn:        { backgroundColor: C.consumer.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
  generateBtnDisabled:{ backgroundColor: C.gray[300] },
  generateBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.consumer.border, marginBottom: 20 },
  resultHeading:      { fontSize: 15, fontWeight: '800', color: C.consumer.text, marginBottom: 12 },
  resultRow:          { marginBottom: 10 },
  rrLabel:            { fontSize: 11, fontWeight: '600', color: C.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  rrValue:            { fontSize: 14, color: C.gray[800], lineHeight: 20 },
  streamLabel:        { fontSize: 12, fontWeight: '600', color: C.gray[500], marginTop: 4, marginBottom: 10 },
  streamRow:          { flexDirection: 'row', gap: 8 },
  streamBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  streamEmoji:        { fontSize: 16 },
  streamName:         { fontSize: 11, fontWeight: '700', color: '#fff' },
  trackRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  trackArt:           { width: 40, height: 40, borderRadius: 6, backgroundColor: C.gray[200] },
  trackName:          { fontSize: 13, fontWeight: '600', color: C.gray[900] },
  trackArtists:       { fontSize: 12, color: C.gray[500], marginTop: 2 },
  trackOpen:          { fontSize: 12, color: '#1DB954', fontWeight: '700' },
  trackEmpty:         { fontSize: 12, color: C.gray[500], paddingVertical: 10 },
  reconnectBox:       { padding: 12, backgroundColor: '#fef3c7', borderRadius: 10, borderWidth: 1, borderColor: '#fcd34d' },
  reconnectText:      { fontSize: 12, color: '#92400e', fontWeight: '600', textAlign: 'center' },
  connectBanner:      { marginTop: 12, padding: 10, backgroundColor: '#dcfce7', borderRadius: 10, borderWidth: 1, borderColor: '#86efac' },
  connectBannerText:  { fontSize: 12, color: '#16a34a', fontWeight: '600', textAlign: 'center' },
  histTitle:          { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10 },
  histCard:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  histMood:           { fontSize: 13, fontWeight: '600', color: C.gray[800] },
  histGenre:          { fontSize: 12, color: C.gray[500], marginTop: 3 },
  reuse:              { fontSize: 16, color: C.gray[300] },
});
