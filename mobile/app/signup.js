import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://savorymind.net';

const OTHER_PROVIDERS = [
  { id: 'github',   label: 'GitHub',    bg: '#1a1a1a', emoji: '🐙' },
  { id: 'azure-ad', label: 'Microsoft', bg: '#0078d4', emoji: '🪟' },
  { id: 'apple',    label: 'Apple',     bg: '#000000', emoji: '🍎' },
  { id: 'facebook', label: 'Facebook',  bg: '#1877F2', emoji: '📘' },
  { id: 'discord',  label: 'Discord',   bg: '#5865F2', emoji: '🎮' },
  { id: 'linkedin', label: 'LinkedIn',  bg: '#0A66C2', emoji: '💼' },
];

const TYPES = [
  { value: 'consumer',   label: '🏠 Food Lover',           color: C.consumer.primary },
  { value: 'diner',      label: '🍽️ Food Explorer',      color: C.diner.primary },
  { value: 'restaurant', label: '🏪 Restaurant Owner',  color: C.restaurant.primary },
];

export default function SignupScreen() {
  const router = useRouter();
  const { register, loginSocial } = useAuth();
  const { type: defaultType } = useLocalSearchParams();
  const [form, setForm] = useState({
    email: '', password: '', display_name: '', account_type: defaultType || 'consumer',
  });
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [error, setError] = useState(null);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

  const [, googleResponse, googlePrompt] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'placeholder',
    redirectUri: makeRedirectUri({ scheme: 'savorymind' }),
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      handleGoogleSuccess(googleResponse.authentication?.accessToken);
    } else {
      setSocialLoading(null);
    }
  }, [googleResponse]);

  const handleGoogleSuccess = async (accessToken) => {
    if (!accessToken) { setSocialLoading(null); return; }
    try {
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      await loginSocial({ provider: 'google', provider_id: userInfo.sub, email: userInfo.email, name: userInfo.name, avatar_url: userInfo.picture });
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGooglePress = async () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google sign-in not configured. Use email or visit the web app.'); return; }
    setSocialLoading('google');
    setError(null);
    await googlePrompt();
  };

  const handleOtherProvider = async (p) => {
    setSocialLoading(p.id);
    try { await WebBrowser.openBrowserAsync(WEB_APP_URL + '/login'); }
    catch { setError('Could not open browser.'); }
    finally { setSocialLoading(null); }
  };

  const handleSignup = async () => {
    if (!form.email.trim() || !form.password || !form.display_name.trim()) {
      setError('All fields are required.'); return;
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError(null);
    try {
      await register({ ...form, email: form.email.trim() });
    } catch (e) {
      setError(e.message || 'Signup failed. Please try again.');
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
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.sub}>Free to start — no card needed.</Text>

          {/* Google */}
          <TouchableOpacity style={styles.googleBtn} onPress={handleGooglePress} disabled={loading || !!socialLoading}>
            {socialLoading === 'google' ? <ActivityIndicator color="#4285F4" size="small" /> : <Text style={styles.googleG}>G</Text>}
            <Text style={styles.googleText}>{socialLoading === 'google' ? 'Connecting...' : 'Sign up with Google'}</Text>
          </TouchableOpacity>
          <View style={styles.socialRow}>
            {OTHER_PROVIDERS.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.socialIcon, { backgroundColor: p.bg }]} onPress={() => handleOtherProvider(p)} disabled={loading || !!socialLoading}>
                {socialLoading === p.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.socialEmoji}>{p.emoji}</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Account type selector */}
          <Text style={styles.label}>I am a...</Text>
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
            <Text style={styles.label}>Display Name</Text>
            <TextInput style={styles.input} value={form.display_name} onChangeText={(v) => set('display_name', v)} placeholder="Your name" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(v) => set('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} value={form.password} onChangeText={(v) => set('password', v)} placeholder="Min. 6 characters" secureTextEntry />

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: activeType?.color || C.gray[900] }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get Started →</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>Already have an account? <Text style={styles.loginBold}>Sign in</Text></Text>
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
