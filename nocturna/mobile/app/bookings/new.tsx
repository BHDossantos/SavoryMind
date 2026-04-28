import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, View } from 'react-native';
import { api } from '@/services/api';
import { Chips } from '@/components/Chips';
import { styles } from '@/lib/theme';
import { REQUEST_TYPES } from '../../../shared/constants/options';

export default function NewBooking() {
  const { venue_id, plan_id, request_type } = useLocalSearchParams<{ venue_id: string; plan_id?: string; request_type?: string }>();
  const router = useRouter();
  const [f, setF] = useState({
    contact_name: '', contact_phone: '', contact_email: '',
    date: new Date().toISOString().slice(0, 10), time: '21:30',
    group_size: 2,
    request_type: request_type || 'dinner',
    budget_eur: '',
    bottle_preference: '',
    arrival_time: '',
    notes: '',
    vip_interest: 'no',
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  async function submit() {
    const payload: any = {
      venue_id: Number(venue_id),
      plan_id: plan_id ? Number(plan_id) : null,
      ...f,
      group_size: Number(f.group_size),
      budget_eur: f.budget_eur ? Number(f.budget_eur) : null,
    };
    const r = await api.post<{ id: number }>('/api/bookings', payload);
    router.replace(`/bookings/${r.id}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>Request booking</Text>
      {(['contact_name', 'contact_phone', 'contact_email', 'date', 'time', 'notes'] as const).map(k => (
        <TextInput key={k} placeholder={k.replace('_', ' ')} placeholderTextColor="#7c7373"
          value={(f as any)[k]} onChangeText={(v) => set(k, v)} style={styles.input} />
      ))}
      <Text style={styles.label}>Group size</Text>
      <TextInput keyboardType="number-pad" value={String(f.group_size)} onChangeText={(v) => set('group_size', v)} style={styles.input} />
      <Text style={styles.label}>Type</Text>
      <Chips value={f.request_type} options={REQUEST_TYPES.map(r => ({ value: r.value, label: r.label }))}
        onChange={(v) => set('request_type', v)} />
      {(f.request_type === 'vip_table' || f.vip_interest === 'yes') && (
        <View>
          {(['budget_eur', 'bottle_preference', 'arrival_time'] as const).map(k => (
            <TextInput key={k} placeholder={k.replace('_', ' ')} placeholderTextColor="#7c7373"
              value={(f as any)[k]} onChangeText={(v) => set(k, v)} style={styles.input} />
          ))}
        </View>
      )}
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Send request</Text>
      </Pressable>
    </ScrollView>
  );
}
