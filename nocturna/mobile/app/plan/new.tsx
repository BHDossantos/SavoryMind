import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, TextInput, ActivityIndicator } from 'react-native';
import { Chips } from '@/components/Chips';
import { api } from '@/services/api';
import { getCurrentLocation } from '@/services/notifications';
import { styles } from '@/lib/theme';
import {
  BUDGET_BANDS, CITIES, GROUP_TYPES, INTENTS, MUSIC, STYLES, TIME_OPTIONS, VIBES,
} from '../../../shared/constants/options';

const STEP_KEYS = ['city', 'intent', 'when', 'vibe', 'music', 'budget', 'group', 'style', 'review'] as const;

export default function PlanNew() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string; city?: string }>();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    city: (params.city as string) || 'rome',
    intent: (params.intent as string) || 'dinner_drinks',
    when: 'tonight',
    vibe_tags: [] as string[],
    music_pref: [] as string[],
    budget_band: '50-100',
    budget_per_person: 75,
    group_type: 'friends',
    group_size: 2,
    style: 'casual',
    accept_long_route: false,
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  const requestedFor = useMemo(() => {
    const now = new Date();
    if (f.when === 'now') return now.toISOString();
    if (f.when === 'tonight') {
      const t = new Date(); t.setHours(21, 0, 0, 0); if (t < now) t.setDate(t.getDate() + 1); return t.toISOString();
    }
    if (f.when === 'tomorrow') { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(21, 0, 0, 0); return t.toISOString(); }
    return now.toISOString();
  }, [f.when]);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const loc = await getCurrentLocation();
      const r = await api.post<{ plans: { id: number }[] }>('/api/planner/generate', {
        ...f,
        requested_for: requestedFor,
        user_lat: loc?.lat,
        user_lng: loc?.lng,
        plan_count: 3,
      });
      router.push(`/plan/${r.plans[0].id}?ids=${r.plans.map(p => p.id).join(',')}`);
    } catch (e: any) {
      setErr(e?.message || 'Could not generate a plan.');
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Step {step + 1} of {STEP_KEYS.length}</Text>
      {STEP_KEYS[step] === 'city' && (
        <>
          <Text style={styles.h2}>Where are you tonight?</Text>
          <Chips value={f.city} options={CITIES.map(c => ({ value: c.slug, label: c.label }))} onChange={(v) => set('city', v)} />
        </>
      )}
      {STEP_KEYS[step] === 'intent' && (
        <>
          <Text style={styles.h2}>What kind of night?</Text>
          <Chips value={f.intent} options={INTENTS as any} onChange={(v) => set('intent', v)} />
        </>
      )}
      {STEP_KEYS[step] === 'when' && (
        <>
          <Text style={styles.h2}>When?</Text>
          <Chips value={f.when} options={TIME_OPTIONS as any} onChange={(v) => set('when', v)} />
        </>
      )}
      {STEP_KEYS[step] === 'vibe' && (
        <>
          <Text style={styles.h2}>Pick your vibes</Text>
          <Chips multi value={f.vibe_tags} options={VIBES as any} onChange={(v) => set('vibe_tags', v)} />
        </>
      )}
      {STEP_KEYS[step] === 'music' && (
        <>
          <Text style={styles.h2}>Music</Text>
          <Chips multi value={f.music_pref} options={MUSIC as any} onChange={(v) => set('music_pref', v)} />
        </>
      )}
      {STEP_KEYS[step] === 'budget' && (
        <>
          <Text style={styles.h2}>Budget per person</Text>
          <Chips value={f.budget_band} options={BUDGET_BANDS.map(b => ({ value: b.value, label: b.label }))}
            onChange={(v) => {
              const b = BUDGET_BANDS.find(x => x.value === v);
              setF({ ...f, budget_band: v, budget_per_person: b?.perPerson || 75 });
            }} />
        </>
      )}
      {STEP_KEYS[step] === 'group' && (
        <>
          <Text style={styles.h2}>Who's coming?</Text>
          <Chips value={f.group_type} options={GROUP_TYPES as any} onChange={(v) => set('group_type', v)} />
          <Text style={styles.label}>Group size</Text>
          <TextInput value={String(f.group_size)} keyboardType="number-pad"
            onChangeText={(v) => set('group_size', Number(v) || 1)} style={styles.input} />
        </>
      )}
      {STEP_KEYS[step] === 'style' && (
        <>
          <Text style={styles.h2}>Tonight's style</Text>
          <Chips value={f.style} options={STYLES as any} onChange={(v) => set('style', v)} />
        </>
      )}
      {STEP_KEYS[step] === 'review' && (
        <>
          <Text style={styles.h2}>Ready to plan</Text>
          <Text style={styles.dim}>{f.city} · {f.intent} · €{f.budget_per_person}/pp · {f.group_type}×{f.group_size}</Text>
          {err && <Text style={{ color: 'tomato', marginTop: 12 }}>{err}</Text>}
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 }}>
        <Pressable onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <Text style={{ color: '#d4af56' }}>{step === 0 ? '' : 'Back'}</Text>
        </Pressable>
        {step < STEP_KEYS.length - 1 ? (
          <Pressable style={styles.btn} onPress={() => setStep(step + 1)}>
            <Text style={styles.btnText}>Next</Text>
          </Pressable>
        ) : busy ? <ActivityIndicator color="#d4af56" /> : (
          <Pressable style={styles.btn} onPress={submit}>
            <Text style={styles.btnText}>Curate</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}
