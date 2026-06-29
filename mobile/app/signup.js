import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://savorymind.net';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

// Google → native flow when configured (commit "wire mobile expo-auth-session"),
// WebBrowser fallback otherwise. Other providers route through the web
// app's OAuth flow until each gets its own backend ID-token verifier.
const SOCIAL_PROVIDERS = [
  { id: 'google',   label: 'Google',    bg: '#fff',     emoji: 'G',  fg: '#4285F4' },
  { id: 'github',   label: 'GitHub',    bg: '#1a1a1a', emoji: '🐙' },
  { id: 'azure-ad', label: 'Microsoft', bg: '#0078d4', emoji: '🪟' },
  { id: 'apple',    label: 'Apple',     bg: '#000000', emoji: '🍎' },
  { id: 'facebook', label: 'Facebook',  bg: '#1877F2', emoji: '📘' },
  { id: 'discord',  label: 'Discord',   bg: '#5865F2', emoji: '🎮' },
  { id: 'linkedin', label: 'LinkedIn',  bg: '#0A66C2', emoji: '💼' },
];

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { register, loginGoogle } = useAuth();
  const { type: defaultType } = useLocalSearchParams();

  // Account-type tiles. Two options after the Food Lover / Food Explorer
  // unification — consumer covers anyone who cooks at home OR eats out
  // (or both); restaurant is for operators. Derived per-render so labels
  // re-translate on language change. `diner` is still a valid backend
  // account_type for legacy accounts, but new signups always pick
  // consumer to land them on the unified shell.
  const TYPES = [
    { value: 'consumer',   label: `🍴 ${t('welcome.foodPerson')}`,       color: C.consumer.primary },
    { value: 'restaurant', label: `🏪 ${t('welcome.restaurantOwner')}`,  color: C.restaurant.primary },
  ];
  // Normalise the URL ?type= param. Old links / shares might still
  // carry ?type=diner — fold it into 'consumer' so users land in the
  // unified shell instead of seeing a non-existent tile selected.
  const normalisedType = defaultType === 'diner' ? 'consumer' : defaultType;
  const [form, setForm] = useState({
    email: '', password: '', display_name: '', account_type: normalisedType || 'consumer',
  });
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [error, setError] = useState(null);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

  // Native Google flow (mirrors login.js — see comments there for the
  // why). When EXPO_PUBLIC_GOOGLE_CLIENT_ID isn't set, the Google tile
  // falls through to the WebBrowser path with the rest of the providers.
  const [, googleResponse, googlePrompt] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'placeholder.apps.googleusercontent.com',
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      const idToken = googleResponse.authentication?.idToken
        || googleResponse.params?.id_token;
      if (!idToken) {
        setError(t('auth.errors.googleNoIdToken'));
        setSocialLoading(null);
        return;
      }
      (async () => {
        try {
          await loginGoogle(idToken);
        } catch (e) {
          setError(e.message || t('auth.errors.googleFailed'));
        } finally {
          setSocialLoading(null);
        }
      })();
    } else if (googleResponse.type === 'error') {
      setError(t('auth.errors.googleFailed'));
      setSocialLoading(null);
    } else {
      setSocialLoading(null);
    }
  }, [googleResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSocialProvider = async (p) => {
    setSocialLoading(p.id);
    setError(null);

    if (p.id === 'google' && GOOGLE_CLIENT_ID) {
      try {
        await googlePrompt();
        return;
      } catch (e) {
        // Fall through to WebBrowser if the native sheet can't open.
      }
    }

    try { await WebBrowser.openBrowserAsync(WEB_APP_URL + '/login'); }
    catch { setError(t('auth.errors.browserFailed')); }
    finally { setSocialLoading(null); }
  };

  const handleSignup = async () => {
    if (!form.email.trim() || !form.password || !form.display_name.trim()) {
      setError(t('auth.errors.allFieldsRequired')); return;
    }
    if (form.password.length < 6) { setError(t('auth.errors.passwordTooShort')); return; }
    setLoading(true);
    setError(null);
    try {
      await register({ ...form, email: form.email.trim() });
    } catch (e) {
      setError(e.message || t('auth.errors.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const activeType = TYPES.find((t) => t.value === form.account_type);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>{t('auth.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.title}>{t('auth.signupTitle')}</Text>
          <Text style={styles.sub}>{t('auth.signupSubtitle')}</Text>

          {/* Social providers — open the web app's OAuth flow in a browser. */}
          <View style={styles.socialRow}>
            {SOCIAL_PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.socialIcon, { backgroundColor: p.bg, borderWidth: p.id === 'google' ? 1 : 0, borderColor: '#d1d5db' }]}
                onPress={() => handleSocialProvider(p)}
                disabled={loading || !!socialLoading}
              >
                {socialLoading === p.id
                  ? <ActivityIndicator color={p.fg || '#fff'} size="small" />
                  : <Text style={[styles.socialEmoji, p.fg && { color: p.fg, fontWeight: '800' }]}>{p.emoji}</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.orSignUpEmail')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Account type selector */}
          <Text style={styles.label}>{t('auth.iAmA')}</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeBtn, form.account_type === t.value && { borderColor: t.color, backgroundColor: t.color + '18' }]}
                onPress={() => set('account_type', t.value)}
              >
                <Text style={[styles.typeBtnText, form.account_type === t.value && { color: t.color, fontWeight: '700' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <View style={styles.form}>
            <Text style={styles.label}>{t('auth.displayName')}</Text>
            <TextInput style={styles.input} value={form.display_name} onChangeText={(v) => set('display_name', v)} placeholder={t('auth.displayNamePlaceholder')} />
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(v) => set('email', v)} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput style={styles.input} value={form.password} onChangeText={(v) => set('password', v)} placeholder={t('auth.passwordMin')} secureTextEntry />

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: activeType?.color || C.gray[900] }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('auth.signupButton')}</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              {t('welcome.alreadyHaveAccount')} <Text style={styles.loginBold}>{t('welcome.signIn')}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  container:   { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  googleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 13, backgroundColor: '#fff', marginBottom: 12 },
  googleG:     { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleText:  { fontSize: 15, fontWeight: '600', color: '#374151' },
  socialRow:   { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
  socialIcon:  { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  socialEmoji: { fontSize: 20 },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: 12, color: '#9ca3af' },
  back:        { marginBottom: 24 },
  backText:    { fontSize: 15, color: C.gray[600] },
  logo:        { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title:       { fontSize: 26, fontWeight: '800', color: C.gray[900], textAlign: 'center' },
  sub:         { fontSize: 14, color: C.gray[500], textAlign: 'center', marginTop: 4, marginBottom: 24 },
  typeRow:     { gap: 8, marginBottom: 16 },
  typeBtn:     { borderWidth: 1.5, borderColor: C.gray[200], borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  typeBtnText: { fontSize: 14, color: C.gray[600] },
  errorBox:    { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText:   { color: C.red, fontSize: 13 },
  form:        { gap: 8 },
  label:       { fontSize: 13, fontWeight: '600', color: C.gray[700], marginTop: 8 },
  input:       { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.gray[900], backgroundColor: C.gray[50] },
  btn:         { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink:   { marginTop: 24, alignItems: 'center' },
  loginText:   { fontSize: 14, color: C.gray[500] },
  loginBold:   { fontWeight: '700', color: C.gray[800] },
});
