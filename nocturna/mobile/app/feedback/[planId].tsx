import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { api } from '@/services/api';
import { styles, colors } from '@/lib/theme';

const FIELDS = ['rating','vibe_accuracy','crowd_rating','music_rating','service_rating','food_rating','drinks_rating','price_accuracy'] as const;

export default function Feedback() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [f, setF] = useState<Record<string, any>>({
    rating: 5, vibe_accuracy: 5, crowd_rating: 5, music_rating: 5, service_rating: 5,
    food_rating: 5, drinks_rating: 5, price_accuracy: 5, would_return: true, comments: '', crowded_level: 'busy',
  });

  async function submit() {
    await api.post('/api/reviews', { plan_id: Number(planId), ...f });
    router.replace('/');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h1}>How was your night?</Text>
      {FIELDS.map(k => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 }}>
          <Text style={styles.dim}>{k.replace(/_/g, ' ')}</Text>
          <View style={{ flexDirection: 'row' }}>
            {[1,2,3,4,5].map(n => (
              <Pressable key={n} onPress={() => setF({ ...f, [k]: n })}
                style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: n <= f[k] ? colors.gold : '#1f1a30', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                <Text style={{ color: n <= f[k] ? colors.bg : colors.dim }}>★</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <TextInput placeholder="Comments" placeholderTextColor="#7c7373"
        value={f.comments} onChangeText={(v) => setF({ ...f, comments: v })}
        style={[styles.input, { height: 80 }]} multiline />
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Submit</Text>
      </Pressable>
    </ScrollView>
  );
}
