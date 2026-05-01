import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SafeScreen from '../../../components/SafeScreen';
import { api } from '../../../services/api';
import { C } from '../../../constants/colors';

export default function DinerRestaurantDetail() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const [restaurant, setRestaurant] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [partySize, setPartySize] = useState(2);

  useEffect(() => {
    if (!id) return;
    api.getRestaurant(Number(id))
      .then(setRestaurant)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !date) return;
    api.getAvailability(Number(id), date).then(setAvailability).catch(() => setAvailability(null));
  }, [id, date]);

  const handleBook = async (slot) => {
    setBooking(true);
    try {
      await api.requestBooking({
        restaurant_id: Number(id),
        date,
        time:  slot,
        party_size: partySize,
      });
      Alert.alert('Booking requested', 'The restaurant will confirm shortly.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not book', e.message || 'Try again.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return (
    <SafeScreen><View style={{ padding: 24 }}><ActivityIndicator color={C.diner.primary} /></View></SafeScreen>
  );
  if (!restaurant) return (
    <SafeScreen>
      <View style={{ padding: 32, alignItems: 'center' }}>
        <Text style={styles.title}>Restaurant not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );

  const slots = availability?.available_slots || [];

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{restaurant.restaurant_name || restaurant.display_name}</Text>
          {restaurant.city && <Text style={styles.sub}>{restaurant.city}{restaurant.country ? `, ${restaurant.country}` : ''}</Text>}
          {restaurant.restaurant_cuisine && <Text style={styles.cuisine}>{restaurant.restaurant_cuisine}</Text>}
        </View>

        {restaurant.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.body}>{restaurant.bio}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Book a table</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.input}>
              <Text style={{ fontSize: 14, color: C.gray[800] }}>{date}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <Text style={styles.label}>Party</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[2, 3, 4, 6, 8].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setPartySize(n)}
                  style={[styles.partyChip, partySize === n && styles.partyChipActive]}
                >
                  <Text style={[styles.partyText, partySize === n && styles.partyTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {slots.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🕐</Text>
              <Text style={styles.emptyTitle}>No slots available for {date}</Text>
              <Text style={styles.emptySub}>Try a different date or party size.</Text>
            </View>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map((s) => (
                <TouchableOpacity
                  key={s}
                  disabled={booking}
                  onPress={() => handleBook(s)}
                  style={styles.slot}
                >
                  <Text style={styles.slotText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header:      { padding: 16 },
  back:        { fontSize: 14, color: C.gray[600], marginBottom: 8 },
  title:       { fontSize: 24, fontWeight: '800', color: C.gray[900] },
  sub:         { fontSize: 13, color: C.gray[500], marginTop: 2 },
  cuisine:     { fontSize: 12, color: C.diner.text, fontWeight: '600', marginTop: 4 },
  section:     { paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle:{ fontSize: 14, fontWeight: '800', color: C.gray[900], marginBottom: 6 },
  body:        { fontSize: 14, color: C.gray[700], lineHeight: 20 },
  label:       { fontSize: 12, fontWeight: '700', color: C.gray[600], width: 56 },
  input:       { flex: 1, padding: 10, borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, backgroundColor: C.gray[50] },
  partyChip:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  partyChipActive: { borderColor: C.diner.primary, backgroundColor: C.diner.light },
  partyText:   { fontSize: 13, color: C.gray[600] },
  partyTextActive: { color: C.diner.text, fontWeight: '700' },
  slotGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  slot:        { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.diner.primary },
  slotText:    { fontSize: 13, fontWeight: '700', color: '#fff' },
  empty:       { padding: 24, alignItems: 'center' },
  emptyEmoji:  { fontSize: 32, marginBottom: 4 },
  emptyTitle:  { fontSize: 14, fontWeight: '700', color: C.gray[800] },
  emptySub:    { fontSize: 12, color: C.gray[500], marginTop: 4, textAlign: 'center' },
});
