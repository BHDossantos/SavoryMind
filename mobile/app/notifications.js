import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SafeScreen from '../components/SafeScreen';
import { api } from '../services/api';
import { C } from '../constants/colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.getNotifications()
      .then((data) => setItems(Array.isArray(data) ? data : data?.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Mark read on visit so the bell badge clears next time the
    // dashboard polls. Best-effort — failures don't block the page.
    api.markNotificationsRead().catch(() => {});
  }, []);

  if (loading) return (
    <SafeScreen><View style={{ padding: 24 }}><ActivityIndicator color={C.consumer.primary} /></View></SafeScreen>
  );

  return (
    <SafeScreen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔔 Notifications</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔕</Text>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptySub}>New booking confirmations, review replies, and updates land here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {items.map((n) => (
            <View key={n.id} style={[styles.row, !n.read && styles.unread]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{n.title || n.message || 'Notification'}</Text>
                {n.body && <Text style={styles.rowBody}>{n.body}</Text>}
                {n.created_at && (
                  <Text style={styles.rowDate}>{new Date(n.created_at).toLocaleString()}</Text>
                )}
              </View>
              {!n.read && <View style={styles.dot} />}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header:     { padding: 16, borderBottomWidth: 1, borderBottomColor: C.gray[100] },
  back:       { fontSize: 14, color: C.gray[600], marginBottom: 8 },
  title:      { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  empty:      { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 36, marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.gray[800] },
  emptySub:   { fontSize: 12, color: C.gray[500], marginTop: 4, textAlign: 'center' },
  row:        { flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.gray[100] },
  unread:     { borderColor: C.consumer.border, backgroundColor: C.consumer.light },
  rowTitle:   { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  rowBody:    { fontSize: 13, color: C.gray[700], marginTop: 4, lineHeight: 18 },
  rowDate:    { fontSize: 11, color: C.gray[400], marginTop: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.consumer.primary, marginTop: 6, marginLeft: 8 },
});
