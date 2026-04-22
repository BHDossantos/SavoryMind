import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

const DIETARY_OPTIONS = ['', 'vegetarian', 'vegan', 'keto', 'gluten_free', 'dairy_free'];
const DIETARY_LABELS  = { '': 'All', vegetarian: 'Vegetarian', vegan: 'Vegan', keto: 'Keto', gluten_free: 'Gluten-Free', dairy_free: 'Dairy-Free' };
const TABS = ['Plan', 'Shopping List'];

export default function Planner() {
  const [tab, setTab]         = useState('Plan');
  const [dietary, setDietary] = useState('');
  const [plan, setPlan]       = useState(null);
  const [shopping, setShopping] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [p, s, d] = await Promise.all([
        api.getMealPlan(dietary),
        api.getShoppingList(dietary),
        api.getDailySuggestion(),
      ]);
      setPlan(p);
      setShopping(s);
      setSuggestion(d);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [dietary]));

  const onDietaryChange = (d) => {
    setDietary(d);
    setLoading(true);
  };

  if (loading) return <LoadingSpinner message="Building your plan..." color={C.consumer.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <SafeScreen onRefresh={load} refreshing={refreshing}>
      {/* Header */}
      <Text style={s.title}>Meal Planner</Text>
      <Text style={s.subtitle}>Your personalised weekly plan</Text>

      {/* Today's suggestion */}
      {suggestion && (
        <View style={s.suggestionCard}>
          <Text style={s.suggestionLabel}>Today's pick — {suggestion.day}</Text>
          <Text style={s.suggestionReason}>{suggestion.reason}</Text>
          <Text style={s.suggestionDish}>
            {suggestion.suggestion.image_emoji || '🍽️'} {suggestion.suggestion.title}
          </Text>
          <Text style={s.suggestionMeta}>
            {suggestion.suggestion.cuisine} · {suggestion.suggestion.time_minutes}min · {suggestion.suggestion.difficulty}
          </Text>
        </View>
      )}

      {/* Dietary filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
        {DIETARY_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d || 'all'}
            style={[s.filterChip, dietary === d && s.filterChipActive]}
            onPress={() => onDietaryChange(d)}
          >
            <Text style={[s.filterChipText, dietary === d && s.filterChipTextActive]}>
              {DIETARY_LABELS[d]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Plan' && plan && (
        <View>
          {plan.days.map((day) => (
            <View key={day.day} style={s.dayCard}>
              <Text style={s.dayName}>{day.day}</Text>
              <MealRow label="Lunch"  meal={day.lunch} />
              <MealRow label="Dinner" meal={day.dinner} />
            </View>
          ))}
        </View>
      )}

      {tab === 'Shopping List' && shopping && (
        <View>
          <Text style={s.shoppingMeta}>{shopping.total_items} items · {DIETARY_LABELS[dietary]} diet</Text>
          {Object.entries(shopping.categories).map(([cat, items]) => (
            <View key={cat} style={s.catBlock}>
              <Text style={s.catTitle}>{cat}</Text>
              {items.map((item, i) => (
                <View key={i} style={s.shoppingItem}>
                  <Text style={s.bullet}>•</Text>
                  <Text style={s.shoppingText}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </SafeScreen>
  );
}

function MealRow({ label, meal }) {
  return (
    <View style={s.mealRow}>
      <Text style={s.mealLabel}>{label}</Text>
      <View style={s.mealInfo}>
        <Text style={s.mealEmoji}>{meal.emoji}</Text>
        <View style={s.mealText}>
          <Text style={s.mealName}>{meal.name}</Text>
          <Text style={s.mealMeta}>{meal.cuisine} · {meal.time_minutes}min</Text>
        </View>
      </View>
    </View>
  );
}

const ACC = C.consumer.primary;

const s = StyleSheet.create({
  title:             { fontSize: 24, fontWeight: '800', color: C.gray[900], marginBottom: 2 },
  subtitle:          { fontSize: 14, color: C.gray[500], marginBottom: 16 },

  suggestionCard:    { backgroundColor: ACC + '12', borderRadius: 14, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: ACC },
  suggestionLabel:   { fontSize: 11, fontWeight: '700', color: ACC, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  suggestionReason:  { fontSize: 12, color: C.gray[500], marginBottom: 6 },
  suggestionDish:    { fontSize: 18, fontWeight: '700', color: C.gray[900] },
  suggestionMeta:    { fontSize: 12, color: C.gray[500], marginTop: 2 },

  filterRow:         { marginBottom: 14 },
  filterContent:     { gap: 8, paddingRight: 16 },
  filterChip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.gray[100] },
  filterChipActive:  { backgroundColor: ACC },
  filterChipText:    { fontSize: 12, fontWeight: '600', color: C.gray[600] },
  filterChipTextActive: { color: '#fff' },

  tabRow:            { flexDirection: 'row', backgroundColor: C.gray[100], borderRadius: 10, padding: 3, marginBottom: 18 },
  tabBtn:            { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive:      { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabText:           { fontSize: 13, fontWeight: '600', color: C.gray[500] },
  tabTextActive:     { color: C.gray[900] },

  dayCard:           { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.gray[100] },
  dayName:           { fontSize: 14, fontWeight: '700', color: ACC, marginBottom: 10 },
  mealRow:           { marginBottom: 8 },
  mealLabel:         { fontSize: 10, fontWeight: '600', color: C.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  mealInfo:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealEmoji:         { fontSize: 24 },
  mealText:          { flex: 1 },
  mealName:          { fontSize: 14, fontWeight: '600', color: C.gray[900] },
  mealMeta:          { fontSize: 12, color: C.gray[500] },

  shoppingMeta:      { fontSize: 12, color: C.gray[500], marginBottom: 12 },
  catBlock:          { marginBottom: 16 },
  catTitle:          { fontSize: 14, fontWeight: '700', color: C.gray[900], marginBottom: 8 },
  shoppingItem:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 6 },
  bullet:            { color: ACC, fontWeight: '700', fontSize: 14 },
  shoppingText:      { fontSize: 13, color: C.gray[700], flex: 1 },
});
