import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';


export default function SpotifyConnectScreen() {
  const router = useRouter();
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Refetch connections every time the screen regains focus — covers the
  // common "user just came back from the OAuth browser session" case
  // without needing to register a deep-link handler.
  const reload = useCallback(async () => {
    try {
      const all = await api.getConnections();
      setConn(all.find((c) => c.platform === 'spotify') || null);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { authorize_url } = await api.startSpotifyAuth();
      // openAuthSessionAsync handles the dismiss case cleanly and the
      // resolution gives us a hook to refetch immediately.
      const result = await WebBrowser.openAuthSessionAsync(authorize_url);
      // result.type can be: success | cancel | dismiss | locked | opened
      if (result.type === 'success' || result.type === 'dismiss') {
        await reload();
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('not configured')) {
        setError('Spotify integration is not configured on the server. Ask the admin to set SPOTIFY_CLIENT_ID/SECRET.');
      } else {
        setError(msg || 'Could not start Spotify authorization.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Spotify?', 'You can reconnect any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.disconnectSpotify();
            await reload();
          } catch (e) {
            setError(e.message || 'Disconnect failed.');
          }
        },
      },
    ]);
  };

  const isConnected = !!conn?.connected;

  return (
    <SafeScreen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔗 Connect Music</Text>
        <Text style={styles.sub}>Link Spotify to play real tracks matched to your mood and food.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator color={C.consumer.primary} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.icon}><Text style={styles.iconText}>🎧</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.cardTitle}>Spotify</Text>
                  {isConnected && <Text style={styles.connectedPill}>✓ Connected</Text>}
                </View>
                <Text style={styles.cardSub}>
                  Real OAuth: your password never touches our servers. Revoke any time at spotify.com/account/apps.
                </Text>
                {isConnected && conn.username ? (
                  <Text style={styles.connectedAs}>Connected as {conn.username}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.actionRow}>
              {isConnected ? (
                <>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleConnect} disabled={busy}>
                    <Text style={styles.secondaryBtnText}>Reconnect</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect}>
                    <Text style={styles.dangerBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleConnect} disabled={busy}>
                  {busy
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.primaryBtnText}>Connect Spotify</Text>}
                </TouchableOpacity>
              )}
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}


const styles = StyleSheet.create({
  header:        { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back:          { fontSize: 14, color: C.gray[600], marginBottom: 8 },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:           { fontSize: 13, color: C.gray[500], marginTop: 4, lineHeight: 18 },

  card:          { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.gray[200], padding: 16, gap: 12 },
  row:           { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon:          { width: 48, height: 48, borderRadius: 14, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  iconText:      { fontSize: 24 },
  cardTitle:     { fontSize: 16, fontWeight: '700', color: C.gray[900] },
  cardSub:       { fontSize: 12, color: C.gray[500], marginTop: 4, lineHeight: 16 },
  connectedPill: { fontSize: 11, fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  connectedAs:   { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 6 },

  actionRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  primaryBtn:    { backgroundColor: '#1DB954', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, flexGrow: 1, alignItems: 'center' },
  primaryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn:  { borderWidth: 1, borderColor: C.consumer.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.consumer.light },
  secondaryBtnText: { color: C.consumer.text, fontWeight: '600', fontSize: 13 },
  dangerBtn:     { borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#fef2f2' },
  dangerBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },

  errorBox:      { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 10 },
  errorText:     { color: '#dc2626', fontSize: 12 },
});
