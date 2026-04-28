import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, Pressable } from 'react-native';
import { useAuth } from '@/services/auth';
import { styles } from '@/lib/theme';

export default function Signup() {
  const router = useRouter();
  const reg = useAuth(s => s.register);
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '' });
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    try { await reg(f.email, f.password, f.name, f.phone); router.replace('/me/plans'); }
    catch (e: any) { setErr(e?.message || 'Failed'); }
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>Create account</Text>
      <TextInput placeholder="Name" placeholderTextColor="#7c7373" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} style={styles.input} />
      <TextInput placeholder="Email" placeholderTextColor="#7c7373" autoCapitalize="none" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} style={styles.input} />
      <TextInput placeholder="Phone" placeholderTextColor="#7c7373" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} style={styles.input} />
      <TextInput placeholder="Password" placeholderTextColor="#7c7373" secureTextEntry value={f.password} onChangeText={(v) => setF({ ...f, password: v })} style={styles.input} />
      {err && <Text style={{ color: 'tomato' }}>{err}</Text>}
      <Pressable style={styles.btn} onPress={submit}><Text style={styles.btnText}>Sign up</Text></Pressable>
    </ScrollView>
  );
}
