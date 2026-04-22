import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
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

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginSocial } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [error, setError] = useState(null);

  const [, googleResponse, googlePrompt] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'placeholder',
    redirectUri: makeRedirectUri({ scheme: 'savorymind' }),
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      handleGoogleSuccess(googleResponse.authentication?.accessToken);
    } else if (googleResponse.type === 'error') {
      setError('Google sign-in failed. Please try again.');
      setSocialLoading(null);
    } else {
      setSocialLoading(null);
    }
  }, [googleResponse]);

  const handleGoogleSuccess = async (accessToken) => {
    if (!accessToken) { setError('Google sign-in failed.'); setSocialLoading(null); return; }
    try {
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());

      await loginSocial({
        provider: 'google',
        provider_id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        avatar_url: userInfo.picture,
      });
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGooglePress = async () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google sign-in not configured. Use email login or visit the web app.'); return; }
    setSocialLoading('google');
    setError(null);
    await googlePrompt();
  };

  const handleOtherProvider = async (p) => {
    setSocialLoading(p.id);
    setError(null);
    try {
      const url = `${WEB_APP_URL}/login`;
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError('Could not open browser.');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || !!socialLoading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your SavoryMind account</Text>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          {/* Google */}
          <TouchableOpacity style={styles.googleBtn} onPress={handleGooglePress} disabled={busy}>
            {socialLoading === 'google'
              ? <ActivityIndicator color="#4285F4" size="small" />
              : <Text style={styles.googleG}>G</Text>
            }
            <Text style={styles.googleText}>
              {socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          {/* Other providers icon row */}
          <View style={styles.socialRow}>
            {OTHER_PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.socialIcon, { backgroundColor: p.bg }]}
                onPress={() => handleOtherProvider(p)}
                disabled={busy}
              >
                {socialLoading === p.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.socialEmoji}>{p.emoji}</Text>
                }
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              placeholder="Your password"
              secureTextEntry
            />
            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={busy}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupLink}>
            <Text style={styles.signupText}>No account? <Text style={styles.signupBold}>Sign up free</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  back:       { marginBottom: 24 },
  backText:   { fontSize: 15, color: C.gray[600] },
  logo:       { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title:      { fontSize: 26, fontWeight: '800', color: C.gray[900], textAlign: 'center' },
  sub:        { fontSize: 14, color: C.gray[500], textAlign: 'center', marginTop: 4, marginBottom: 24 },
  errorBox:   { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:  { color: C.red, fontSize: 13 },
  googleBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 13, backgroundColor: '#fff', marginBottom: 12 },
  googleG:    { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  socialRow:  { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
  socialIcon: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  socialEmoji:{ fontSize: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine:{ flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText:{ fontSize: 12, color: '#9ca3af' },
  form:       { gap: 8 },
  label:      { fontSize: 13, fontWeight: '600', color: C.gray[700], marginTop: 8 },
  input:      { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.gray[900], backgroundColor: C.gray[50] },
  btn:        { backgroundColor: C.gray[900], borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  signupLink: { marginTop: 24, alignItems: 'center' },
  signupText: { fontSize: 14, color: C.gray[500] },
  signupBold: { fontWeight: '700', color: C.gray[800] },
});
