import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

interface Msg { role: 'user' | 'assistant'; content: string; plans?: any[] }

export default function Chat() {
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    api.post<{ session_token: string; greeting: string }>('/api/chat/start', { city: 'rome' }).then(r => {
      setToken(r.session_token); setMsgs([{ role: 'assistant', content: r.greeting }]);
    });
  }, []);

  async function send() {
    if (!input.trim() || !token) return;
    const text = input.trim(); setInput('');
    setMsgs(m => [...m, { role: 'user', content: text }]); setBusy(true);
    try {
      const r = await api.post<{ reply: string; plans: any[] }>('/api/chat/send', { session_token: token, message: text });
      setMsgs(m => [...m, { role: 'assistant', content: r.reply, plans: r.plans }]);
      setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 100);
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={ref} contentContainerStyle={{ padding: 16 }}>
        {msgs.map((m, i) => (
          <View key={i} style={{
            backgroundColor: m.role === 'user' ? colors.gold + '33' : colors.card,
            borderRadius: 16, padding: 12, marginBottom: 8,
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
          }}>
            <Text style={{ color: colors.text }}>{m.content}</Text>
            {m.plans?.map((p, j) => (
              <Text key={j} style={{ color: colors.gold, marginTop: 6 }}>
                · {p.label} (€{p.estimated_cost_eur})
              </Text>
            ))}
          </View>
        ))}
        {busy && <Text style={styles.dim}>Thinking…</Text>}
      </ScrollView>
      <View style={{ flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Plan tonight…" placeholderTextColor="#7c7373"
          style={[styles.input, { flex: 1, marginRight: 8 }]} />
        <Pressable style={styles.btn} onPress={send}><Text style={styles.btnText}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
