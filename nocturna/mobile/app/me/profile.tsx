import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Pressable } from 'react-native';
import { api } from '@/services/api';
import { useAuth } from '@/services/auth';
import { styles } from '@/lib/theme';

export default function Profile() {
  const logout = useAuth(s => s.logout);
  const [me, setMe] = useState<any>(null);
  useEffect(() => { api.get('/api/auth/me').then(setMe).catch(() => setMe(null)); }, []);
  if (!me) return <Text style={[styles.dim, { padding: 20 }]}>Sign in to view profile.</Text>;
  async function save() { await api.put('/api/auth/me', me); }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>Profile</Text>
      <TextInput value={me.name || ''} onChangeText={(v) => setMe({ ...me, name: v })} placeholder="Name" placeholderTextColor="#7c7373" style={styles.input} />
      <TextInput value={me.phone || ''} onChangeText={(v) => setMe({ ...me, phone: v })} placeholder="Phone" placeholderTextColor="#7c7373" style={styles.input} />
      <TextInput value={me.home_city} onChangeText={(v) => setMe({ ...me, home_city: v })} placeholder="Home city" placeholderTextColor="#7c7373" style={styles.input} />
      <Pressable style={styles.btn} onPress={save}><Text style={styles.btnText}>Save</Text></Pressable>
      <Pressable style={styles.btnSecondary} onPress={logout}><Text style={styles.btnSecondaryText}>Sign out</Text></Pressable>
    </ScrollView>
  );
}
