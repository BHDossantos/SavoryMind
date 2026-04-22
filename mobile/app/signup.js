import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../constants/colors';

const TYPES = [
  { value: 'consumer',   label: '🏠 Home Cook',        color: C.consumer.primary },
  { value: 'diner',      label: '🍽️ Diner',            color: C.diner.primary },
  { value: 'restaurant', label: '🏪 Restaurant Owner',  color: C.restaurant.primary },
];

export default function SignupScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { type: defaultType } = useLocalSearchParams();
  const [form, setForm] = useState({
    email: '', password: '', display_name: '', account_type: defaultType || 'consumer',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

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
  container:   { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
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
