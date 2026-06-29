import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuth from 'expo-apple-authentication';
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
  const { t } = useTranslation();
  const { login, loginGoogle, loginApple } = useAuth();
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

    // Native Sign in with Apple — iOS only. Required by App Store
    // Guideline 4.8 because we offer Google. On Android (and on iOS
    // when somehow unavailable) this falls through to the WebBrowser
    // path, which currently 404s gracefully on the web app — but we
    // never expect Apple sign-in to be invoked from non-iOS devices
    // because the tile shouldn't appear there (handled in the SOCIAL_PROVIDERS
    // filter below).
    if (p.id === 'apple' && Platform.OS === 'ios') {
      try {
        const credential = await AppleAuth.signInAsync({
          requestedScopes: [
            AppleAuth.AppleAuthenticationScope.FULL_NAME,
            AppleAuth.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          setError(t('auth.errors.appleNoIdToken'));
          setSocialLoading(null);
          return;
        }
        // fullName is null after the very first sign-in (Apple's design).
        // Always include whatever the SDK gave us; backend uses the
        // existing user row's name on subsequent sign-ins.
        const name = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(' ')
          .trim();
        await loginApple({
          idToken: credential.identityToken,
          name:    name || null,
          email:   credential.email || null,
        });
        return;
      } catch (e) {
        // ERR_CANCELED is the user dismissing the sheet — silent.
        if (e?.code === 'ERR_CANCELED' || e?.code === 'ERR_REQUEST_CANCELED') {
          setSocialLoading(null);
          return;
        }
        setError(e?.message || t('auth.errors.appleFailed'));
        setSocialLoading(null);
        return;
      }
    }

    try {
      await WebBrowser.openBrowserAsync(`${WEB_APP_URL}/login`);
    } catch {
      setError(t('auth.errors.browserFailed'));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError(t('auth.errors.credentialsRequired')); return; }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || t('auth.errors.loginFailed'));
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
            <Text style={styles.backText}>{t('auth.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.title}>{t('auth.signInTitle')}</Text>
          <Text style={styles.sub}>{t('auth.signInSubtitle')}</Text>

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
            <Text style={styles.dividerText}>{t('auth.orSignInEmail')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(null); }}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry
            />
            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={busy}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('auth.signInButton')}</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupLink}>
            <Text style={styles.signupText}>
              {t('auth.noAccount')} <Text style={styles.signupBold}>{t('auth.signUpFree')}</Text>
            </Text>
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
