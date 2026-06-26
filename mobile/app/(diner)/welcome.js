/**
 * Diner welcome — parity with frontend/src/pages/diner/welcome.js.
 *
 * First impression for a brand-new diner account: hero with their name
 * + three feature cards (Discover, Book, Visits). Sample restaurants
 * appear once preferences land.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

function pj(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const BUDGET_MAX = { budget: 2, mid: 3, luxury: 4 };

export default function DinerWelcomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  const firstName = user?.first_name || user?.display_name?.split(' ')[0] || 'Explorer';
  const cuisines = pj(user?.cuisine_preferences, []);
  const budget = user?.dining_budget || 'mid';

  useEffect(() => {
    (async () => {
      try {
        const r = await api.discoverRestaurants({
          max_price_level: BUDGET_MAX[budget] || 3,
          cuisine: cuisines[0] || '',
        });
        setRestaurants((r || []).slice(0, 4));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  const FEATURES = [
    { icon: '🔍', title: t('dinerWelcomePage.featDiscoverTitle'), desc: t('dinerWelcomePage.featDiscoverDesc'), cta: t('dinerWelcomePage.featDiscoverCta'), route: '/discover' },
    { icon: '📅', title: t('dinerWelcomePage.featBookTitle'),     desc: t('dinerWelcomePage.featBookDesc'),     cta: t('dinerWelcomePage.featBookCta'),     route: '/book' },
    { icon: '📖', title: t('dinerWelcomePage.featVisitsTitle'),   desc: t('dinerWelcomePage.featVisitsDesc'),   cta: t('dinerWelcomePage.featVisitsCta'),   route: '/history' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 60 }}>
      <View style={styles.hero}>
        <Text style={styles.heroBadge}>{t('dinerWelcomePage.welcomeBadge')}</Text>
        <Text style={styles.heroTitle}>{t('dinerWelcomePage.hey', { name: firstName })}</Text>
        <Text style={styles.heroSub}>{t('dinerWelcomePage.subtitle')}</Text>
        {cuisines.length > 0 && (
          <View style={styles.chipRow}>
            {cuisines.slice(0, 4).map((c) => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {FEATURES.map((f) => (
        <TouchableOpacity key={f.title} style={styles.featureCard} onPress={() => router.push(f.route)} activeOpacity={0.85}>
          <Text style={styles.featureIcon}>{f.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
          <Text style={styles.featureCta}>{f.cta} →</Text>
        </TouchableOpacity>
      ))}

      {restaurants.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>{t('dinerWelcomePage.recommendedHeader')}</Text>
          {restaurants.map((r) => (
            <TouchableOpacity
              key={r.id || r.place_id}
              style={styles.restaurantCard}
              onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: r.id || r.place_id } })}
              activeOpacity={0.85}
            >
              <Text style={styles.restaurantName}>{r.name}</Text>
              {r.cuisine && <Text style={styles.restaurantMeta}>{r.cuisine}</Text>}
              {r.address && <Text style={styles.restaurantMeta}>{r.address}</Text>}
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero:           { backgroundColor: C.diner.dark, borderRadius: 24, padding: 22, marginBottom: 18 },
  heroBadge:      { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  heroTitle:      { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  heroSub:        { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 12, lineHeight: 20 },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText:       { color: '#fff', fontSize: 11, fontWeight: '600' },
  featureCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  featureIcon:    { fontSize: 26 },
  featureTitle:   { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  featureDesc:    { fontSize: 11, color: C.gray[500], marginTop: 2 },
  featureCta:     { fontSize: 12, color: C.diner.primary, fontWeight: '700' },
  sectionHeader:  { fontSize: 13, fontWeight: '700', color: C.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 10 },
  restaurantCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.gray[100] },
  restaurantName: { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  restaurantMeta: { fontSize: 11, color: C.gray[500], marginTop: 2 },
});
