import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { useFocusEffect, useRouter } from 'expo-router';

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [pairings, setPairings] = useState([]);
  const [moods, setMoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Quick-actions strip. Derived per-render so the labels re-translate
  // when the active language changes; the route + icon stay static.
  const QUICK = [
    { icon: '🍷', label: t('nav.pairings'),  route: '/(consumer)/pairings' },
    { icon: '🎵', label: t('nav.musicMood'), route: '/(consumer)/music' },
    { icon: '👨‍🍳', label: t('nav.recipes'), route: '/(consumer)/recipes' },
    { icon: '🥫', label: t('nav.pantry'),    route: '/(consumer)/pantry' },
    { icon: '📓', label: t('nav.journal'),   route: '/(consumer)/journal' },
    { icon: '🔗', label: t('nav.connect'),   route: '/(consumer)/social' },
    { icon: '🛵', label: t('nav.order'),     route: '/(consumer)/order' },
  ];

  const load = async () => {
    try {
      const [p, m, n] = await Promise.all([
        api.getWinePairings(),
        api.getMusicMoods(),
        // Notifications is optional — never block the dashboard on it.
        api.getNotifications().catch(() => null),
      ]);
      setPairings(p.slice(0, 3)); setMoods(m.slice(0, 3));
      const list = Array.isArray(n) ? n : n?.notifications || [];
      setUnreadCount(list.filter((x) => !x.read).length);
    } catch {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message={t('dashboard.loading')} color={C.consumer.primary} />;

  const firstName = user?.display_name?.split(' ')[0];

  return (
    <SafeScreen onRefresh={load}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.greetingFallback')}
          </Text>
          <Text style={styles.sub}>{t('dashboard.consumerSubtitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={styles.bell}
          hitSlop={10}
          accessibilityLabel={t('notifications.title')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        {QUICK.map((q) => (
          <TouchableOpacity key={q.label} style={[styles.quickCard, { borderColor: C.consumer.border }]} onPress={() => router.push(q.route)} activeOpacity={0.8}>
            <Text style={styles.quickIcon}>{q.icon}</Text>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Featured: Flavor — SavoryMind's unified AI voice, backed by
          Claude Opus 4.7. Earns visual weight over the rule-based
          pairing/music tiles above because Flavor is the product's
          personality, not just a feature tile. */}
      <TouchableOpacity
        style={styles.assistantCard}
        onPress={() => router.push('/(consumer)/assistant')}
        activeOpacity={0.85}
      >
        <Text style={styles.assistantEmoji}>👨‍🍳</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.assistantTitle}>{t('dashboard.askFlavor')}</Text>
          <Text style={styles.assistantSub}>{t('dashboard.askFlavorSub')}</Text>
        </View>
        <Text style={styles.assistantArrow}>→</Text>
      </TouchableOpacity>

      {pairings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('dashboard.recentPairings')}</Text>
          {pairings.map((p, i) => (
            <View key={i} style={styles.recentCard}>
              <Text style={styles.recentIcon}>🍷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{p.dish}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{p.wine_recommendation}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {moods.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('dashboard.recentMusicMoods')}</Text>
          {moods.map((m, i) => (
            <View key={i} style={styles.recentCard}>
              <Text style={styles.recentIcon}>🎵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{m.mood} · {m.cuisine}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{m.genre_recommendation}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  topBar:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  greeting:    { fontSize: 26, fontWeight: '800', color: C.gray[900], marginBottom: 4 },
  sub:         { fontSize: 14, color: C.gray[500] },
  bell:        { padding: 8, position: 'relative' },
  bellIcon:    { fontSize: 22 },
  bellBadge:   { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  quickGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  quickCard:   { width: '47%', backgroundColor: C.consumer.light, borderRadius: 16, padding: 16, borderWidth: 1.5, alignItems: 'center' },
  quickIcon:   { fontSize: 32, marginBottom: 8 },
  quickLabel:  { fontSize: 13, fontWeight: '700', color: C.consumer.text, textAlign: 'center' },
  assistantCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.consumer.primary, borderRadius: 16, padding: 16, marginBottom: 28 },
  assistantEmoji:   { fontSize: 32 },
  assistantTitle:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  assistantSub:     { fontSize: 12, color: '#fff', opacity: 0.85, marginTop: 2, lineHeight: 16 },
  assistantArrow:   { fontSize: 20, color: '#fff', fontWeight: '700' },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: C.gray[800], marginBottom: 10 },
  recentCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  recentIcon:  { fontSize: 22 },
  recentTitle: { fontSize: 13, fontWeight: '600', color: C.gray[900] },
  recentSub:   { fontSize: 12, color: C.gray[500], marginTop: 2 },
});
