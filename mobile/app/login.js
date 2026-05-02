import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://savorymind.net';
// EXPO_PUBLIC_GOOGLE_CLIENT_ID enables native Google sign-in via
// expo-auth-session. Without it, Google falls through to the same
// WebBrowser-to-web-app fallback the other providers use. The client ID
// here MUST match GOOGLE_CLIENT_ID on the backend (the `aud` claim
// the verifier checks).
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

// Google → native flow when configured, WebBrowser fallback otherwise.
// All other providers route through the web app's OAuth flow until each
// gets its own backend ID-token verifier (see services/google_oauth.py).
const SOCIAL_PROVIDERS = [
  { id: 'google',   label: 'Google',    bg: '#fff',     emoji: 'G',  fg: '#4285F4' },
  { id: 'github',   label: 'GitHub',    bg: '#1a1a1a', emoji: '🐙' },
  { id: 'azure-ad', label: 'Microsoft', bg: '#0078d4', emoji: '🪟' },
  { id: 'apple',    label: 'Apple',     bg: '#000000', emoji: '🍎' },
  { id: 'facebook', label: 'Facebook',  bg: '#1877F2', emoji: '📘' },
  { id: 'discord',  label: 'Discord',   bg: '#5865F2', emoji: '🎮' },
  { id: 'linkedin', label: 'LinkedIn',  bg: '#0A66C2', emoji: '💼' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [error, setError] = useState(null);

  // expo-auth-session Google provider. When GOOGLE_CLIENT_ID isn't set
  // we still build the request (with a placeholder) but never prompt
  // — the social tile falls through to the WebBrowser path below.
  const [, googleResponse, googlePrompt] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'placeholder.apps.googleusercontent.com',
    // 'openid' guarantees we get an idToken back; 'profile' + 'email'
    // populate the claims social_login() reads to build the user.
    scopes: ['openid', 'profile', 'email'],
  });

  // Watch for the Google flow completing — the user has either granted
  // (success), denied (error), or dismissed the sheet. On success we
  // hand the idToken to the backend verifier.
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      const idToken = googleResponse.authentication?.idToken
        || googleResponse.params?.id_token;  // fallback for response_type=token
      if (!idToken) {
        setError('Google sign-in didn\'t return an ID token. Try again.');
        setSocialLoading(null);
        return;
      }
      (async () => {
        try {
          await loginGoogle(idToken);
        } catch (e) {
          setError(e.message || 'Google sign-in failed.');
        } finally {
          setSocialLoading(null);
        }
      })();
    } else if (googleResponse.type === 'error') {
      setError('Google sign-in failed. Please try again.');
      setSocialLoading(null);
    } else {
      setSocialLoading(null);  // cancel / dismiss
    }
  }, [googleResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSocialProvider = async (p) => {
    setSocialLoading(p.id);
    setError(null);

    // Native Google flow when configured. Falls through to the
    // WebBrowser path on failure or when GOOGLE_CLIENT_ID is unset.
    if (p.id === 'google' && GOOGLE_CLIENT_ID) {
      try {
        await googlePrompt();
        return;  // useEffect above handles the response
      } catch (e) {
        // Fall through to WebBrowser fallback if the native sheet
        // can't be presented (e.g. simulator without Google services).
      }
    }

    try {
      await WebBrowser.openBrowserAsync(`${WEB_APP_URL}/login`);
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

          {/* Social providers — open the web app's OAuth flow in a browser.
              Native OAuth on mobile is a separate follow-up. */}
          <View style={styles.socialRow}>
            {SOCIAL_PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.socialIcon, { backgroundColor: p.bg, borderWidth: p.id === 'google' ? 1 : 0, borderColor: '#d1d5db' }]}
                onPress={() => handleSocialProvider(p)}
                disabled={busy}
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
