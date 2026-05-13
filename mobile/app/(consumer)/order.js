import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { api } from '../../services/api';


// Mirror frontend/src/pages/consumer/order.js — 4-step wizard:
//   0. Pick a craving + budget → load matching dishes
//   1. Pick a dish              → load restaurants for the dish's cuisine
//   2. Pick a restaurant        → confirm the order
//   3. Place the (mock) order   → success screen
//
// "Place order" is a mock — no real fulfillment yet. The web version
// also fakes it. When real ordering ships this is the file that gets
// the actual checkout call.
const CRAVINGS = [
  { id: 'rich_warm',   emoji: '🍲', label: 'Rich & Warm',     desc: 'Stews, braised mains, hearty bowls' },
  { id: 'light_fresh', emoji: '🥗', label: 'Light & Fresh',   desc: 'Salads, grain bowls, sushi, poke' },
  { id: 'spicy_bold',  emoji: '🌶️', label: 'Spicy & Bold',    desc: 'Curries, tacos, Korean, Thai' },
  { id: 'comfort',     emoji: '🍕', label: 'Comfort Food',    desc: 'Pizza, burgers, pasta, fried chicken' },
  { id: 'fast_easy',   emoji: '⚡', label: 'Fast & Easy',     desc: 'Ready in 25 min or less' },
  { id: 'sweet_treat', emoji: '🍰', label: 'Something Sweet', desc: 'Desserts, pastries, waffles' },
];

const BUDGETS = [
  { id: '',         label: 'Any',    sub: 'All prices' },
  { id: 'budget',   label: 'Budget', sub: 'Under $15' },
  { id: 'midrange', label: 'Mid',    sub: '$15–$25' },
  { id: 'treat',    label: 'Treat',  sub: '$25+' },
];


function Steps({ current }) {
  const steps = ['Craving', 'Dish', 'Restaurant', 'Order'];
  return (
    <View style={styles.stepRow}>
      {steps.map((s, i) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepBadge, i <= current && styles.stepBadgeActive]}>
            <Text style={[styles.stepBadgeText, i <= current && styles.stepBadgeTextActive]}>
              {i < current ? '✓' : i + 1}
            </Text>
          </View>
          <Text style={[styles.stepLabel, i <= current && styles.stepLabelActive]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}


export default function OrderScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep]                   = useState(0);
  const [craving, setCraving]             = useState(null);
  const [budget, setBudget]               = useState('');
  const [dishes, setDishes]               = useState([]);
  const [dishLoading, setDishLoading]     = useState(false);
  const [dishError, setDishError]         = useState('');
  const [dish, setDish]                   = useState(null);
  const [restaurants, setRestaurants]     = useState([]);
  const [restLoading, setRestLoading]     = useState(false);
  const [restError, setRestError]         = useState('');
  const [restaurant, setRestaurant]       = useState(null);
  const [address, setAddress]             = useState('');
  const [note, setNote]                   = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [ordered, setOrdered]             = useState(false);

  const firstName = user?.first_name || user?.display_name?.split(' ')[0] || 'there';

  const selectCraving = async (c) => {
    setCraving(c); setDish(null); setRestaurant(null); setDishes([]);
    setDishError(''); setStep(1); setDishLoading(true);
    try {
      const data = await api.getDeliveryDishes(c.id, budget);
      setDishes(data.dishes || []);
      if (!data.dishes?.length) setDishError('No dishes found — try a different craving.');
    } catch (e) {
      setDishError(e.message);
    } finally {
      setDishLoading(false);
    }
  };

  const selectDish = async (d) => {
    setDish(d); setRestaurant(null); setRestaurants([]);
    setStep(2); setRestLoading(true); setRestError('');
    try {
      const data = await api.getDeliveryRestaurants(d.cuisine);
      setRestaurants(data.restaurants || []);
    } catch (e) {
      setRestError(e.message || 'Failed to load restaurants.');
    } finally {
      setRestLoading(false);
    }
  };

  const selectRestaurant = (r) => { setRestaurant(r); setStep(3); };

  const placeOrder = async () => {
    if (!address.trim()) return;
    setSubmitting(true);
    // Mock fulfillment delay — same as web version.
    await new Promise((r) => setTimeout(r, 1400));
    setOrdered(true); setSubmitting(false);
  };

  const reset = () => {
    setOrdered(false); setStep(0); setCraving(null); setDish(null);
    setRestaurant(null); setDishes([]); setRestaurants([]);
    setAddress(''); setNote(''); setBudget('');
  };

  if (ordered) {
    return (
      <View style={styles.successScreen} testID="order-success">
        <Text style={styles.successEmoji}>🛵</Text>
        <Text style={styles.successTitle}>Order placed!</Text>
        <Text style={styles.successSub}>
          Your <Text style={{ fontWeight: '700' }}>{dish?.name}</Text> from{' '}
          <Text style={{ fontWeight: '700' }}>{restaurant?.name}</Text> is on its way.
        </Text>
        <Text style={styles.successEta}>Estimated delivery: {restaurant?.eta}</Text>
        <TouchableOpacity onPress={reset} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Order something else</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('screens.order.title')}</Text>
        <Text style={styles.subtitle}>What are you feeling, {firstName}?</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Steps current={step} />

        {step === 0 && (
          <View>
            <Text style={styles.sectionTitle}>What are you hungry for?</Text>
            <Text style={styles.sectionSub}>We'll find dishes — then show who delivers them best.</Text>

            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Budget:</Text>
              {BUDGETS.map((b) => (
                <TouchableOpacity
                  key={b.id || 'any'}
                  onPress={() => setBudget(b.id)}
                  style={[styles.budgetChip, budget === b.id && styles.budgetChipActive]}
                  testID={`budget-${b.id || 'any'}`}
                >
                  <Text style={[styles.budgetChipText, budget === b.id && styles.budgetChipTextActive]}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.cravingGrid}>
              {CRAVINGS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.cravingCard}
                  onPress={() => selectCraving(c)}
                  testID={`craving-${c.id}`}
                >
                  <Text style={styles.cravingEmoji}>{c.emoji}</Text>
                  <Text style={styles.cravingLabel}>{c.label}</Text>
                  <Text style={styles.cravingDesc}>{c.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 1 && craving && (
          <View>
            <BackChip onPress={() => setStep(0)} chipLabel={`${craving.emoji} ${craving.label}`} />

            <Text style={styles.sectionTitle}>Choose a dish</Text>
            <Text style={styles.sectionSub}>Matched to your craving — we'll find who delivers after.</Text>

            {dishLoading && <ActivityIndicator size="large" color={C.consumer.primary} style={{ marginVertical: 24 }} />}
            {dishError && (
              <View style={styles.emptyCenter}>
                <Text style={styles.emptyText}>{dishError}</Text>
                <TouchableOpacity onPress={() => setStep(0)}>
                  <Text style={styles.linkText}>← Try another craving</Text>
                </TouchableOpacity>
              </View>
            )}
            {!dishLoading && !dishError && dishes.map((d) => (
              <TouchableOpacity key={d.id} style={styles.dishCard} onPress={() => selectDish(d)} testID={`dish-${d.id}`}>
                <Text style={styles.dishEmoji}>{d.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.dishName}>{d.name}</Text>
                    <Text style={styles.dishPrice}>{d.price}</Text>
                  </View>
                  <Text style={styles.dishMeta}>{d.cuisine} · {d.time}</Text>
                  <View style={styles.dishTags}>
                    <Text style={styles.dishRating}>★ {d.rating}</Text>
                    <View style={[
                      styles.dishDifficulty,
                      d.difficulty === 'Easy'  && { backgroundColor: '#dcfce7' },
                      d.difficulty === 'Medium' && { backgroundColor: '#fef3c7' },
                      d.difficulty === 'Hard'   && { backgroundColor: '#fee2e2' },
                    ]}>
                      <Text style={styles.dishDifficultyText}>{d.difficulty}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && dish && (
          <View>
            <BackChip onPress={() => setStep(1)} chipLabel={`${dish.emoji} ${dish.name}`} />

            <Text style={styles.sectionTitle}>Who delivers this best?</Text>
            <Text style={styles.sectionSub}>Ranked by rating and speed.</Text>

            {restLoading && <ActivityIndicator size="large" color={C.consumer.primary} style={{ marginVertical: 24 }} />}
            {restError && (
              <View style={styles.emptyCenter}>
                <Text style={styles.emptyText}>{restError}</Text>
              </View>
            )}
            {!restLoading && !restError && restaurants.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.restCard}
                onPress={() => selectRestaurant(r)}
                testID={`restaurant-${r.id}`}
              >
                <Text style={styles.restEmoji}>{r.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.restName}>{r.name}</Text>
                    {r.best_match && (
                      <View style={styles.bestMatchBadge}>
                        <Text style={styles.bestMatchText}>Best match</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.restMeta}>★ {r.rating} · {r.dist_km} km · {r.eta}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.restFee, r.fee === 'Free delivery' && { color: '#16a34a' }]}>{r.fee}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && dish && restaurant && (
          <View>
            <BackChip onPress={() => setStep(2)} chipLabel={`from ${restaurant.name}`} />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeader}>Your order</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 28 }}>{dish.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  <Text style={styles.dishMeta}>{dish.cuisine} · from {restaurant.name}</Text>
                </View>
                <Text style={styles.dishPrice}>{dish.price}</Text>
              </View>
              <View style={styles.summaryFooter}>
                <Text style={styles.summaryFooterText}>🚗 {restaurant.eta}</Text>
                <Text style={styles.summaryFooterText}>📍 {restaurant.dist_km} km</Text>
                <Text style={[styles.summaryFooterText, restaurant.fee === 'Free delivery' && { color: '#16a34a', fontWeight: '700' }]}>
                  {restaurant.fee}
                </Text>
              </View>
            </View>

            <Text style={styles.formLabel}>Delivery address *</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address…"
              placeholderTextColor={C.gray[400]}
              style={styles.formInput}
              testID="address-input"
            />

            <Text style={styles.formLabel}>Note for the kitchen (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Allergies, spice level, special requests…"
              placeholderTextColor={C.gray[400]}
              style={[styles.formInput, { minHeight: 60 }]}
              multiline
            />

            <TouchableOpacity
              onPress={placeOrder}
              disabled={!address.trim() || submitting}
              style={[styles.primaryBtn, { marginTop: 16 }, (!address.trim() || submitting) && { opacity: 0.5 }]}
              testID="place-order-btn"
            >
              {submitting
                ? <Text style={styles.primaryBtnText}>🛵 Placing order…</Text>
                : <Text style={styles.primaryBtnText}>Place order · {dish.price}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}


function BackChip({ onPress, chipLabel }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <TouchableOpacity onPress={onPress} testID="back-chip">
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.contextChip}>
        <Text style={styles.contextChipText}>{chipLabel}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  topBar:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  subtitle:     { fontSize: 13, color: C.gray[500], marginTop: 2 },

  stepRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  stepItem:     { alignItems: 'center', flex: 1 },
  stepBadge:    { width: 28, height: 28, borderRadius: 14, backgroundColor: C.consumer.light, alignItems: 'center', justifyContent: 'center' },
  stepBadgeActive: { backgroundColor: C.consumer.primary },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: C.consumer.primary },
  stepBadgeTextActive: { color: '#fff' },
  stepLabel:    { fontSize: 10, color: C.gray[400], marginTop: 4, fontWeight: '600' },
  stepLabelActive: { color: C.consumer.primary },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.gray[900], marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: C.gray[500], marginBottom: 16 },

  budgetRow:    { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 16 },
  budgetLabel:  { fontSize: 12, fontWeight: '600', color: C.gray[600], marginRight: 4 },
  budgetChip:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.consumer.border, backgroundColor: '#fff' },
  budgetChipActive: { backgroundColor: C.consumer.primary, borderColor: C.consumer.primary },
  budgetChipText: { fontSize: 11, fontWeight: '600', color: C.gray[600] },
  budgetChipTextActive: { color: '#fff' },

  cravingGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cravingCard:  { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.consumer.border },
  cravingEmoji: { fontSize: 24, marginBottom: 4 },
  cravingLabel: { fontSize: 13, fontWeight: '700', color: C.gray[900] },
  cravingDesc:  { fontSize: 11, color: C.gray[500], marginTop: 2 },

  dishCard:     { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.consumer.border, alignItems: 'center', gap: 12 },
  dishEmoji:    { fontSize: 30 },
  dishName:     { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  dishPrice:    { fontSize: 14, fontWeight: '700', color: C.consumer.primary },
  dishMeta:     { fontSize: 11, color: C.gray[500], marginTop: 2 },
  dishTags:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dishRating:   { fontSize: 11, fontWeight: '700', color: '#f59e0b' },
  dishDifficulty: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  dishDifficultyText: { fontSize: 10, fontWeight: '700', color: C.gray[700] },

  restCard:     { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.consumer.border, alignItems: 'center', gap: 12 },
  restEmoji:    { fontSize: 26 },
  restName:     { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  restMeta:     { fontSize: 11, color: C.gray[500], marginTop: 2 },
  restFee:      { fontSize: 11, fontWeight: '600', color: C.gray[500] },
  bestMatchBadge: { backgroundColor: C.consumer.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  bestMatchText:  { fontSize: 9, fontWeight: '700', color: '#fff' },

  summaryCard:    { backgroundColor: C.consumer.light, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.consumer.border },
  summaryHeader:  { fontSize: 11, fontWeight: '700', color: C.consumer.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  summaryFooter:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.consumer.border },
  summaryFooterText: { fontSize: 11, color: C.gray[600] },

  formLabel:    { fontSize: 12, fontWeight: '700', color: C.gray[700], marginTop: 12, marginBottom: 6 },
  formInput:    { borderWidth: 1, borderColor: C.consumer.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.gray[900], backgroundColor: '#fff' },

  primaryBtn:     { backgroundColor: C.consumer.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  emptyCenter:  { alignItems: 'center', paddingVertical: 24 },
  emptyText:    { fontSize: 13, color: C.gray[500], marginBottom: 8 },
  linkText:     { fontSize: 13, color: C.consumer.primary, fontWeight: '700' },

  backText:     { fontSize: 13, color: C.consumer.primary, fontWeight: '700' },
  contextChip:  { backgroundColor: C.consumer.light, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  contextChipText: { fontSize: 12, color: C.consumer.primary, fontWeight: '600' },

  successScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successEmoji:  { fontSize: 60, marginBottom: 16 },
  successTitle:  { fontSize: 24, fontWeight: '800', color: C.gray[900], marginBottom: 8 },
  successSub:    { fontSize: 14, color: C.gray[600], textAlign: 'center', marginBottom: 4 },
  successEta:    { fontSize: 13, color: C.gray[400], marginBottom: 24 },
});
