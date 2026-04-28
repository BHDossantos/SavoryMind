import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, Pressable } from 'react-native';
import { api } from '@/services/api';
import { styles } from '@/lib/theme';

export default function NewGroup() {
  const router = useRouter();
  const [title, setTitle] = useState('Tonight');
  const [city, setCity] = useState('rome');
  const [planIds, setPlanIds] = useState('');

  async function create() {
    const r = await api.post<{ invite_token: string }>('/api/groups', {
      title, city,
      requested_for: new Date().toISOString(),
      plan_ids: planIds.split(',').map(s => Number(s.trim())).filter(Boolean),
    });
    router.replace(`/groups/${r.invite_token}`);
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>Plan with friends</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor="#7c7373" style={styles.input} />
      <TextInput value={city} onChangeText={setCity} placeholder="city" placeholderTextColor="#7c7373" style={styles.input} />
      <TextInput value={planIds} onChangeText={setPlanIds} placeholder="Plan IDs (1,2,3) — optional" placeholderTextColor="#7c7373" style={styles.input} />
      <Pressable style={styles.btn} onPress={create}><Text style={styles.btnText}>Create group</Text></Pressable>
    </ScrollView>
  );
}
