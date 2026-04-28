import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, Pressable, View, Switch } from 'react-native';
import { api } from '@/services/api';
import { Chips } from '@/components/Chips';
import { styles, colors } from '@/lib/theme';
import { REQUEST_TYPES } from '../../../shared/constants/options';

const DEFAULT_TYPE: Record<string, string> = {
  restaurant: 'dinner', late_food: 'dinner',
  bar: 'bar_table', lounge: 'bar_table', speakeasy: 'bar_table',
  rooftop: 'bar_table', live_music: 'bar_table',
  club: 'guestlist',
};

interface PerStop { venue_id: number; skip: boolean; request_type: string; time: string; notes: string; vip_interest: 'yes' | 'no' }

export default function NewBooking() {
  const { venue_id, plan_id, request_type } = useLocalSearchParams<{ venue_id?: string; plan_id?: string; request_type?: string }>();
  const router = useRouter();
  const isPlanFlow = !!plan_id;
  const [plan, setPlan] = useState<any>(null);
  const [stops, setStops] = useState<PerStop[]>([]);
  const [shared, setShared] = useState({
    contact_name: '', contact_phone: '', contact_email: '',
    group_size: 2, notes: '',
  });
  // Single-venue (legacy) state
  const [single, setSingle] = useState({
    date: new Date().toISOString().slice(0, 10), time: '21:30',
    request_type: request_type || 'dinner',
    budget_eur: '', bottle_preference: '', arrival_time: '',
    vip_interest: 'no',
  });

  useEffect(() => {
    if (isPlanFlow) {
      api.get<any>(`/api/plans/${plan_id}`).then(p => {
        setPlan(p);
        setShared(s => ({ ...s, group_size: p.group_size }));
        setStops(p.stops.map((s: any) => ({
          venue_id: s.venue_id, skip: false,
          request_type: DEFAULT_TYPE[(s.venue?.type as string) || s.type] || 'dinner',
          time: (s.slot_start || '').slice(11, 16),
          notes: '', vip_interest: 'no',
        })));
      });
    }
  }, [plan_id]);

  const setStop = (i: number, patch: Partial<PerStop>) => setStops(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const skippedAll = useMemo(() => stops.length > 0 && stops.every(s => s.skip), [stops]);

  async function submitPlan() {
    const r = await api.post<{ plan_id: number }>(`/api/bookings/plan/${plan_id}`, {
      ...shared, group_size: Number(shared.group_size) || 2,
      overrides: stops.filter(s => s.skip || s.vip_interest === 'yes' || s.notes),
    });
    router.replace(`/plan/${r.plan_id}/bookings`);
  }

  async function submitSingle() {
    const r = await api.post<{ id: number }>('/api/bookings', {
      venue_id: Number(venue_id),
      ...shared, ...single,
      group_size: Number(shared.group_size),
      budget_eur: single.budget_eur ? Number(single.budget_eur) : null,
    });
    router.replace(`/bookings/${r.id}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h2}>{isPlanFlow ? 'Book this plan' : 'Request booking'}</Text>
      {isPlanFlow && plan && <Text style={styles.dim}>{plan.label} · {plan.stops.length} stops</Text>}
      {isPlanFlow && plan && (
        <Text style={[styles.dim, { marginBottom: 12 }]}>One submission books everything.</Text>
      )}

      <Text style={styles.label}>Your contact</Text>
      <TextInput placeholder="Name" placeholderTextColor="#7c7373" value={shared.contact_name}
        onChangeText={(v) => setShared({ ...shared, contact_name: v })} style={styles.input} />
      <TextInput placeholder="Phone" placeholderTextColor="#7c7373" value={shared.contact_phone}
        onChangeText={(v) => setShared({ ...shared, contact_phone: v })} style={styles.input} />
      <TextInput placeholder="Email" placeholderTextColor="#7c7373" autoCapitalize="none" value={shared.contact_email}
        onChangeText={(v) => setShared({ ...shared, contact_email: v })} style={styles.input} />
      <TextInput placeholder="Group size" placeholderTextColor="#7c7373" keyboardType="number-pad" value={String(shared.group_size)}
        onChangeText={(v) => setShared({ ...shared, group_size: Number(v) || 2 })} style={styles.input} />
      <TextInput placeholder="Notes for every venue (optional)" placeholderTextColor="#7c7373" value={shared.notes}
        onChangeText={(v) => setShared({ ...shared, notes: v })} multiline style={[styles.input, { height: 60 }]} />

      {isPlanFlow ? (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>Stops</Text>
          {plan?.stops.map((s: any, i: number) => {
            const st = stops[i];
            if (!st) return null;
            return (
              <View key={s.venue_id} style={[styles.venueCard, { width: '100%', opacity: st.skip ? 0.45 : 1 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dim}>
                      {new Date(s.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.slot_role}
                    </Text>
                    <Text style={styles.cardTitle}>{s.name}</Text>
                  </View>
                  <Switch value={!st.skip} onValueChange={(v) => setStop(i, { skip: !v })}
                    thumbColor={!st.skip ? colors.gold : '#666'} />
                </View>
                {!st.skip && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.label}>Type</Text>
                    <Chips value={st.request_type}
                      options={REQUEST_TYPES.map(r => ({ value: r.value, label: r.label }))}
                      onChange={(v) => setStop(i, { request_type: v })} />
                    <TextInput placeholder="HH:MM" placeholderTextColor="#7c7373" value={st.time}
                      onChangeText={(v) => setStop(i, { time: v })} style={styles.input} />
                    <TextInput placeholder="Notes for this venue" placeholderTextColor="#7c7373" value={st.notes}
                      onChangeText={(v) => setStop(i, { notes: v })} multiline style={[styles.input, { height: 50 }]} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Switch value={st.vip_interest === 'yes'} onValueChange={(v) => setStop(i, { vip_interest: v ? 'yes' : 'no' })}
                        thumbColor={st.vip_interest === 'yes' ? colors.gold : '#666'} />
                      <Text style={{ color: colors.text, marginLeft: 8 }}>VIP table here</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <Pressable style={styles.btn} disabled={skippedAll} onPress={submitPlan}>
            <Text style={styles.btnText}>
              Submit {stops.filter(s => !s.skip).length} booking{stops.filter(s => !s.skip).length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput placeholder="Date YYYY-MM-DD" placeholderTextColor="#7c7373" value={single.date}
            onChangeText={(v) => setSingle({ ...single, date: v })} style={styles.input} />
          <TextInput placeholder="Time HH:MM" placeholderTextColor="#7c7373" value={single.time}
            onChangeText={(v) => setSingle({ ...single, time: v })} style={styles.input} />
          <Text style={styles.label}>Type</Text>
          <Chips value={single.request_type} options={REQUEST_TYPES.map(r => ({ value: r.value, label: r.label }))}
            onChange={(v) => setSingle({ ...single, request_type: v })} />
          <Pressable style={styles.btn} onPress={submitSingle}><Text style={styles.btnText}>Send request</Text></Pressable>
        </>
      )}
    </ScrollView>
  );
}
