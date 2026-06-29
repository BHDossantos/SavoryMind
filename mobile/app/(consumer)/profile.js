import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { setLanguage, SUPPORTED_LANGUAGES } from '../../services/i18n';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

export default function ConsumerProfile() {
  const { t, i18n } = useTranslation();
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

  // Flip the active language. Persists locally (SecureStore) and
  // PATCHes the user profile so Flavor + recommendations + web all
  // see the new preference on the next call.
  const handlePickLanguage = async (code) => {
    if (code === i18n.language) return;
    await setLanguage(code, {
      syncToServer: (payload) => api.updateAuthProfile(payload),
    });
    // Reflect the change in auth context so AuthContext's effect
    // re-syncs and the rest of the app re-renders.
    setUser((u) => ({ ...u, language: code }));
  };

  const LANGUAGE_LABEL = {
    en: t('profile.languageEnglish'),
    es: t('profile.languageSpanish'),
    it: t('profile.languageItalian'),
    pt: t('profile.languagePortuguese'),
    fr: t('profile.languageFrench'),
  };

  // Spotify is the only connected service that uses real OAuth — the
  // labels-only flow was removed elsewhere in this PR. Tapping the
  // Spotify row routes to the dedicated connect screen.

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.display_name || 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>

        <Text style={styles.sectionTitle}>{t('profile.displayName')}</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder={t('auth.displayNamePlaceholder')} />

        <Text style={styles.sectionTitle}>{t('profile.bio')}</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline />

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={savingProfile}>
          {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('profile.save')}</Text>}
        </TouchableOpacity>

        {/* Language picker. Lives here (rather than a separate settings
            screen) for the v1 cut — keeps reviewer-discovery one tap
            from the main nav. */}
        <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
        <Text style={styles.sectionHint}>{t('profile.languageDescription')}</Text>
        <View style={styles.langCol}>
          {SUPPORTED_LANGUAGES.map((code) => {
            const active = i18n.language === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.langRow, active && styles.langRowActive]}
                onPress={() => handlePickLanguage(code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                  {LANGUAGE_LABEL[code]}
                </Text>
                {active && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

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
  sectionHint:     { fontSize: 12, color: C.gray[500], marginTop: -4, marginBottom: 8 },
  langCol:         { gap: 8, marginBottom: 24 },
  langRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.gray[100] },
  langRowActive:   { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  langLabel:       { fontSize: 14, color: C.gray[800] },
  langLabelActive: { fontWeight: '700', color: C.consumer.primary },
  langCheck:       { fontSize: 16, fontWeight: '700', color: C.consumer.primary },
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
