import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

// Canonical filter values stay as English-keyed strings — the backend
// reads these. Display labels go through t() inside the component.
const MOODS = ['', 'romantic', 'adventurous', 'relaxed', 'celebratory', 'group', 'healthy', 'cozy'];
const BUDGETS = ['budget', 'mid', 'luxury'];
const PRICE_LABELS = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export default function Discover() {
  const { t } = useTranslation();
  const [mood, setMood]       = useState('');
  const [cuisine, setCuisine] = useState('');
  const [budget, setBudget]   = useState('mid');
  const [results, setResults] = useState([]);
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showPlan, setShowPlan] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const MOOD_LABELS = {
    '':           t('discoverScreen.moodAny'),
    romantic:     t('discoverScreen.moodRomantic'),
    adventurous:  t('discoverScreen.moodAdventurous'),
    relaxed:      t('discoverScreen.moodRelaxed'),
    celebratory:  t('discoverScreen.moodCelebratory'),
    group:        t('discoverScreen.moodGroup'),
    healthy:      t('discoverScreen.moodHealthy'),
    cozy:         t('discoverScreen.moodCozy'),
  };
  const BUDGET_LABELS = {
    budget: t('discoverScreen.budgetBudget'),
    mid:    t('discoverScreen.budgetMid'),
    luxury: t('discoverScreen.budgetLuxury'),
  };

  const maxPrice = { budget: 2, mid: 3, luxury: 4 }[budget] || 3;

  const search = async () => {
    setLoading(true);
    setError(null);
    setShowPlan(false);
    try {
      const params = { mood, max_price_level: maxPrice };
      if (cuisine.trim()) params.cuisine = cuisine.trim();
      const data = await api.discoverRestaurants(params);
      setResults(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const planExperience = async () => {
    setPlanLoading(true);
    try {
      const data = await api.getExperiencePlan({ mood, cuisine: cuisine.trim(), budget });
      setPlan(data);
      setShowPlan(true);
    } catch (e) { setError(e.message); }
    finally { setPlanLoading(false); }
  };

  useFocusEffect(useCallback(() => { search(); }, []));

  return (
    <SafeScreen onRefresh={search} refreshing={refreshing}>
      <Text style={s.title}>{t('discoverScreen.title')}</Text>
      <Text style={s.subtitle}>{t('discoverScreen.subtitle')}</Text>

      {/* Mood filter */}
      <Text style={s.filterLabel}>{t('discoverScreen.filterMood')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
        {MOODS.map((m) => (
          <TouchableOpacity
            key={m || 'any'}
            style={[s.chip, mood === m && s.chipActive]}
            onPress={() => setMood(m)}
          >
            <Text style={[s.chipText, mood === m && s.chipTextActive]}>{MOOD_LABELS[m]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Budget filter */}
      <Text style={s.filterLabel}>{t('discoverScreen.filterBudget')}</Text>
      <View style={s.budgetRow}>
        {BUDGETS.map((b) => (
          <TouchableOpacity key={b} style={[s.budgetBtn, budget === b && s.budgetBtnActive]} onPress={() => setBudget(b)}>
            <Text style={[s.budgetText, budget === b && s.budgetTextActive]}>{BUDGET_LABELS[b]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cuisine input */}
      <TextInput
        style={s.input}
        placeholder={t('discoverScreen.cuisinePlaceholder')}
        value={cuisine}
        onChangeText={setCuisine}
        placeholderTextColor={C.gray[400]}
      />

      {/* Actions */}
      <View style={s.btnRow}>
        <TouchableOpacity style={s.searchBtn} onPress={search} disabled={loading}>
          <Text style={s.searchBtnText}>{loading ? t('discoverScreen.searching') : t('discoverScreen.search')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.planBtn} onPress={planExperience} disabled={planLoading}>
          <Text style={s.planBtnText}>{planLoading ? '…' : t('discoverScreen.planNight')}</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={s.errorText}>{error}</Text>}

      {/* Experience plan */}
      {showPlan && plan && (
        <View style={s.planCard}>
          <Text style={s.planTitle}>{plan.experience_title}</Text>
          <View style={s.planRow}>
            <Text style={s.planIcon}>{plan.restaurant.emoji}</Text>
            <View style={s.planInfo}>
              <Text style={s.planRestaurant}>{plan.restaurant.name}</Text>
              <Text style={s.planDetail}>{plan.restaurant.standout_dish}</Text>
            </View>
          </View>
          <View style={s.planMeta}>
            <PlanPill icon="🎵" label={plan.music.genre} />
            <PlanPill icon="🍷" label={plan.drink} />
          </View>
          <TouchableOpacity style={s.closePlan} onPress={() => setShowPlan(false)}>
            <Text style={s.closePlanText}>{t('discoverScreen.close')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {results.length > 0 && (
        <View>
          <Text style={s.resultsHeader}>{t('discoverScreen.placesFound', { count: results.length })}</Text>
          {results.map((r) => <RestaurantCard key={r.id} r={r} t={t} />)}
        </View>
      )}

      {!loading && results.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🍽️</Text>
          <Text style={s.emptyText}>{t('discoverScreen.emptyTitle')}</Text>
          <Text style={s.emptyHint}>{t('discoverScreen.emptyHint')}</Text>
        </View>
      )}
    </SafeScreen>
  );
}

function RestaurantCard({ r, t }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardEmoji}>{r.emoji}</Text>
        <View style={s.cardInfo}>
          <Text style={s.cardName}>{r.name}</Text>
          <Text style={s.cardCuisine}>{r.cuisine} · {PRICE_LABELS[r.price_level]}</Text>
        </View>
        <View style={s.ratingBadge}>
          <Text style={s.ratingText}>⭐ {r.rating}</Text>
        </View>
      </View>
      <Text style={s.cardDesc} numberOfLines={2}>{r.description}</Text>
      <View style={s.cardMeta}>
        <Text style={s.cardMetaItem}>{t('discoverScreen.kmAway', { km: r.distance_km })}</Text>
        {r.wait_minutes > 0 && <Text style={s.cardMetaItem}>{t('discoverScreen.minWait', { min: r.wait_minutes })}</Text>}
        <Text style={[s.cardMetaItem, s.openNow]}>{r.open_now ? t('discoverScreen.open') : t('discoverScreen.closed')}</Text>
      </View>
      <Text style={s.standout}>⭐ {r.standout_dish}</Text>
      <View style={s.tagRow}>
        {(r.tags || []).slice(0, 3).map((tag) => (
          <View key={tag} style={s.tag}><Text style={s.tagText}>{tag}</Text></View>
        ))}
      </View>
    </View>
  );
}

function PlanPill({ icon, label }) {
  return (
    <View style={s.planPill}>
      <Text style={s.planPillText}>{icon} {label}</Text>
    </View>
  );
}

const ACC = C.diner.primary;

const s = StyleSheet.create({
  title:          { fontSize: 24, fontWeight: '800', color: C.gray[900], marginBottom: 2 },
  subtitle:       { fontSize: 14, color: C.gray[500], marginBottom: 16 },
  filterLabel:    { fontSize: 11, fontWeight: '700', color: C.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  filterRow:      { marginBottom: 14 },
  filterContent:  { gap: 8, paddingRight: 16 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.gray[100] },
  chipActive:     { backgroundColor: ACC },
  chipText:       { fontSize: 12, fontWeight: '600', color: C.gray[600] },
  chipTextActive: { color: '#fff' },
  budgetRow:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  budgetBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.gray[100], alignItems: 'center' },
  budgetBtnActive:{ backgroundColor: ACC },
  budgetText:     { fontSize: 13, fontWeight: '600', color: C.gray[600] },
  budgetTextActive:{ color: '#fff' },
  input:          { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.gray[200], padding: 12, fontSize: 14, color: C.gray[900], marginBottom: 14 },
  btnRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchBtn:      { flex: 2, backgroundColor: ACC, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  searchBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  planBtn:        { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: ACC },
  planBtnText:    { color: ACC, fontWeight: '700', fontSize: 14 },
  errorText:      { color: '#ef4444', fontSize: 13, marginBottom: 12 },

  planCard:       { backgroundColor: ACC + '12', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: ACC + '30' },
  planTitle:      { fontSize: 17, fontWeight: '800', color: C.gray[900], marginBottom: 12 },
  planRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  planIcon:       { fontSize: 32 },
  planInfo:       { flex: 1 },
  planRestaurant: { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  planDetail:     { fontSize: 13, color: C.gray[500], marginTop: 2 },
  planMeta:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  planPill:       { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  planPillText:   { fontSize: 12, fontWeight: '600', color: C.gray[700] },
  closePlan:      { alignSelf: 'flex-end' },
  closePlanText:  { fontSize: 12, color: C.gray[400] },

  resultsHeader:  { fontSize: 12, fontWeight: '600', color: C.gray[500], marginBottom: 10 },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.gray[100] },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  cardEmoji:      { fontSize: 28 },
  cardInfo:       { flex: 1 },
  cardName:       { fontSize: 16, fontWeight: '700', color: C.gray[900] },
  cardCuisine:    { fontSize: 12, color: C.gray[500] },
  ratingBadge:    { backgroundColor: '#fef9c3', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText:     { fontSize: 12, fontWeight: '700', color: '#854d0e' },
  cardDesc:       { fontSize: 13, color: C.gray[600], marginBottom: 8, lineHeight: 18 },
  cardMeta:       { flexDirection: 'row', gap: 12, marginBottom: 8 },
  cardMetaItem:   { fontSize: 12, color: C.gray[500] },
  openNow:        { fontWeight: '600' },
  standout:       { fontSize: 12, color: C.gray[700], fontStyle: 'italic', marginBottom: 8 },
  tagRow:         { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag:            { backgroundColor: C.gray[100], borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:        { fontSize: 11, color: C.gray[600] },

  emptyState:     { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 16, fontWeight: '700', color: C.gray[700], marginBottom: 4 },
  emptyHint:      { fontSize: 13, color: C.gray[400] },
});
