import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

export default function ConsumerProfile() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [connections, setConnections] = useState({});

  const loadConnections = async () => {
    try {
      const data = await api.getConnections();
      const map = {};
      data.forEach((c) => { map[c.platform] = c; });
      setConnections(map);
    } catch {}
  };

  useFocusEffect(useCallback(() => { loadConnections(); }, []));

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile({ display_name: displayName, bio });
      setUser((u) => ({ ...u, ...updated }));
    } catch {}
    finally { setSavingProfile(false); }
  };

  // Spotify is the only connected service that uses real OAuth — the
  // labels-only flow was removed elsewhere in this PR. Tapping the
  // Spotify row routes to the dedicated connect screen.

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.display_name || 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>

        <Text style={styles.sectionTitle}>Display Name</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" />

        <Text style={styles.sectionTitle}>Bio</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} placeholder="Tell us about your food journey..." multiline />

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={savingProfile}>
          {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Connected Services</Text>
        <TouchableOpacity
          style={styles.platformRow}
          onPress={() => router.push('/(consumer)/social')}
          activeOpacity={0.7}
        >
          <Text style={styles.platformIcon}>🎧</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.platformName}>Spotify</Text>
            {connections.spotify?.connected && connections.spotify?.username && (
              <Text style={styles.platformSub}>Connected as {connections.spotify.username}</Text>
            )}
          </View>
          <View style={[styles.connectBtn, connections.spotify?.connected && styles.connectedBtn]}>
            <Text style={[styles.connectBtnText, connections.spotify?.connected && styles.connectedBtnText]}>
              {connections.spotify?.connected ? 'Connected ✓' : 'Connect'}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:           { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  logoutBtn:       {},
  logoutText:      { fontSize: 13, color: C.gray[400] },
  avatar:          { width: 72, height: 72, borderRadius: 36, backgroundColor: C.consumer.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  avatarText:      { color: '#fff', fontSize: 30, fontWeight: '800' },
  email:           { textAlign: 'center', fontSize: 13, color: C.gray[500], marginBottom: 24 },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: C.gray[700], marginBottom: 8, marginTop: 4 },
  input:           { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: '#fff', marginBottom: 12 },
  saveBtn:         { backgroundColor: C.consumer.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 28 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  platformRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  platformIcon:    { fontSize: 22, marginRight: 12 },
  platformName:    { fontSize: 14, fontWeight: '600', color: C.gray[800] },
  platformSub:     { fontSize: 12, color: C.gray[500], marginTop: 2 },
  connectBtn:      { borderWidth: 1.5, borderColor: C.consumer.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  connectBtnText:  { fontSize: 12, fontWeight: '700', color: C.consumer.primary },
  connectedBtn:    { backgroundColor: C.consumer.light, borderColor: C.consumer.border },
  connectedBtnText:{ color: C.consumer.muted },
});
