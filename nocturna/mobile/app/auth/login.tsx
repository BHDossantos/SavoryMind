import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, Pressable } from 'react-native';
import { useAuth } from '@/services/auth';
import { styles } from '@/lib/theme';

export default function Login() {
  const router = useRouter();
  const login = useAuth(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    try { await login(email, password); router.replace('/me/plans'); }
    catch (e: any) { setErr(e?.message || 'Failed'); }
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>Sign in</Text>
      <TextInput placeholder="Email" placeholderTextColor="#7c7373" autoCapitalize="none" value={email} onChangeText={setEmail} style={styles.input} />
      <TextInput placeholder="Password" placeholderTextColor="#7c7373" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
      {err && <Text style={{ color: 'tomato' }}>{err}</Text>}
      <Pressable style={styles.btn} onPress={submit}><Text style={styles.btnText}>Sign in</Text></Pressable>
      <Pressable style={styles.btnSecondary} onPress={() => router.push('/auth/signup')}><Text style={styles.btnSecondaryText}>Create account</Text></Pressable>
    </ScrollView>
  );
}
