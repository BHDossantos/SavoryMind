import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>🧠</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your SavoryMind account</Text>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

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
            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupLink}>
            <Text style={styles.signupText}>No account? <Text style={styles.signupBold}>Sign up free</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  kav:        { flex: 1 },
  container:  { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  back:       { marginBottom: 24 },
  backText:   { fontSize: 15, color: C.gray[600] },
  logo:       { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title:      { fontSize: 26, fontWeight: '800', color: C.gray[900], textAlign: 'center' },
  sub:        { fontSize: 14, color: C.gray[500], textAlign: 'center', marginTop: 4, marginBottom: 28 },
  errorBox:   { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:  { color: C.red, fontSize: 13 },
  form:       { gap: 8 },
  label:      { fontSize: 13, fontWeight: '600', color: C.gray[700], marginTop: 8 },
  input:      { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.gray[900], backgroundColor: C.gray[50] },
  btn:        { backgroundColor: C.gray[900], borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  signupLink: { marginTop: 24, alignItems: 'center' },
  signupText: { fontSize: 14, color: C.gray[500] },
  signupBold: { fontWeight: '700', color: C.gray[800] },
});
