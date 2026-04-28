import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

export default function Group() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [g, setG] = useState<any>(null);
  const [name, setName] = useState('');
  const [voter, setVoter] = useState('');

  useEffect(() => {
    (async () => {
      let v = await SecureStore.getItemAsync('nocturna.voter');
      if (!v) { v = String(Math.random()).slice(2); await SecureStore.setItemAsync('nocturna.voter', v); }
      setVoter(v);
      api.get(`/api/groups/${token}`).then(setG);
    })();
  }, [token]);

  async function vote(plan_id: number) {
    const r = await api.post(`/api/groups/${token}/vote`, { plan_id, voter_token: voter, voter_name: name || 'Anon' });
    setG(r);
  }

  if (!g) return <Text style={[styles.dim, { padding: 20 }]}>Loading…</Text>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h1}>{g.title || 'Tonight'}</Text>
      <Text style={styles.dim}>{g.status} · {g.city}</Text>
      <TextInput placeholder="Your name" placeholderTextColor="#7c7373" value={name} onChangeText={setName} style={styles.input} />
      {g.options.map((o: any) => (
        <View key={o.plan_id} style={[styles.venueCard, { width: '100%' }]}>
          <Text style={styles.cardTitle}>{o.label || `Plan ${o.plan_id}`}</Text>
          <Text style={styles.dim}>{g.tally?.[o.plan_id] || 0} votes</Text>
          <Pressable style={styles.btn} onPress={() => vote(o.plan_id)}>
            <Text style={styles.btnText}>Vote</Text>
          </Pressable>
        </View>
      ))}
      {g.selected_plan_id && <Text style={{ color: colors.gold }}>Winner: plan {g.selected_plan_id}</Text>}
    </ScrollView>
  );
}
