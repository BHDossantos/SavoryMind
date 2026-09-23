import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { useAuth } from '@/services/auth';
import { styles, colors } from '@/lib/theme';

export default function Profile() {
  const router = useRouter();
  const logout = useAuth(s => s.logout);
  const [me, setMe] = useState<any>(null);
  useEffect(() => { api.get('/api/auth/me').then(setMe).catch(() => setMe(null)); }, []);
  if (!me) return <Text style={[styles.dim, { padding: 20 }]}>Sign in to view profile.</Text>;
  async function save() { await api.put('/api/auth/me', me); }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your Nocturna account, saved venues and preferences. Past bookings are anonymised. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.del('/api/auth/me');
              await logout();
              router.replace('/');
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message || 'Try again later.');
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>Profile</Text>
      <TextInput value={me.name || ''} onChangeText={(v) => setMe({ ...me, name: v })} placeholder="Name" placeholderTextColor="#7c7373" style={styles.input} />
      <TextInput value={me.phone || ''} onChangeText={(v) => setMe({ ...me, phone: v })} placeholder="Phone" placeholderTextColor="#7c7373" style={styles.input} />
      <TextInput value={me.home_city} onChangeText={(v) => setMe({ ...me, home_city: v })} placeholder="Home city" placeholderTextColor="#7c7373" style={styles.input} />
      <Pressable style={styles.btn} onPress={save}><Text style={styles.btnText}>Save</Text></Pressable>
      <Pressable style={styles.btnSecondary} onPress={logout}><Text style={styles.btnSecondaryText}>Sign out</Text></Pressable>

      <Pressable
        onPress={confirmDelete}
        style={[styles.btnSecondary, { marginTop: 32, borderColor: 'rgba(231, 97, 94, 0.5)' }]}
      >
        <Text style={[styles.btnSecondaryText, { color: '#e7615e' }]}>Delete account</Text>
      </Pressable>
      <Text style={[styles.dim, { fontSize: 11, textAlign: 'center', marginTop: 8 }]}>
        Deleting removes your account and preferences permanently. Past bookings are anonymised.
      </Text>
    </ScrollView>
  );
}
