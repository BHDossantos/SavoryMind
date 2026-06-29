/**
 * Mood-to-Meal — native surface of the consumer wedge.
 *
 *   "Tell us how you feel. We'll tell you what to eat."
 *
 * Mirrors web's /discover/mood: mood → experience → budget → out/home,
 * one API call, a shareable result card. Signed-in users get their
 * stored taste profile mixed in server-side (the api helper forwards
 * the bearer token automatically), so unlike web there's no inline
 * taste mini-profile step — mobile users are always authenticated.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { track } from '../../services/analytics';

const MOODS = [
  { id: 'cozy',        emoji: '🕯️' },
  { id: 'adventurous', emoji: '🌍' },
  { id: 'romantic',    emoji: '💞' },
  { id: 'celebrating', emoji: '🎉' },
  { id: 'stressed',    emoji: '😮‍💨' },
  { id: 'energized',   emoji: '⚡' },
  { id: 'curious',     emoji: '🧐' },
  { id: 'comfort',     emoji: '🫶' },
];

const EXPERIENCES = [
  { id: 'fast',      emoji: '⚡' },
  { id: 'healthy',   emoji: '🥗' },
  { id: 'indulgent', emoji: '🍫' },
  { id: 'luxury',    emoji: '✨' },
  { id: 'social',    emoji: '🥂' },
  { id: 'date',      emoji: '🌹' },
];

const BUDGETS = ['low', 'medium', 'high'];

export default function MoodToMealScreen() {
  const router         = useRouter();
  const { t, i18n }    = useTranslation();
  const [mood, setMood]         = useState('');
  const [exp, setExp]           = useState('');
  const [budget, setBudget]     = useState('');
  const [atHome, setAtHome]     = useState(false);
  const [location, setLocation] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);
  const [restaurants, setRestaurants] = useState([]);

  const ready = mood && exp && budget;

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.moodToMeal({
        mood, experience: exp, budget,
        location: location.trim() || null,
        at_home: atHome,
        language: i18n.language,
      });
      setResult(res.recommendation);
      setRestaurants(Array.isArray(res.restaurants) ? res.restaurants : []);
      track('wedge_mood_completed', { source: res.source, mood, experience: exp, budget, platform: 'mobile', restaurants_count: (res.restaurants || []).length });
    } catch (e) {
      setError(e.message || t('moodScreen.errGeneric'));
      track('wedge_mood_failed', { platform: 'mobile' });
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `${result.share_title}\n${result.share_subtitle}\n\n— SavoryMind\nhttps://savorymind.net/s?t=${encodeURIComponent(result.share_title || "")}`,
      });
      track('wedge_mood_shared', { method: 'native', platform: 'mobile' });
    } catch {}
  };

  const reset = () => {
    setMood(''); setExp(''); setBudget('');
    setAtHome(false); setLocation(''); setResult(null); setError(null);
    setRestaurants([]);
  };

  const bookAt = (r) => {
    track('wedge_mood_restaurant_click', { slug: r.slug, platform: 'mobile' });
    // The guest-booking page lives on the web — open it in a browser
    // so a non-account-holder can complete the reservation. expo-web-
    // browser would be tighter UX but isn't a dependency of this screen
    // yet; native Linking handles the universal-link gracefully.
    require('react-native').Linking.openURL(`https://savorymind.net/r/${r.slug}`);
  };

  if (result) {
    return (
      <SafeScreen>
        <Text style={styles.eyebrow}>SavoryMind</Text>
        <Text style={styles.shareTitle}>{result.share_title}</Text>
        <Text style={styles.shareSubtitle}>{result.share_subtitle}</Text>

        <View style={styles.resultCard}>
          <View style={styles.resultHero}>
            <Text style={styles.resultLabelLight}>{t('moodScreen.cardDish')}</Text>
            <Text style={styles.resultDish}>{result.dish}</Text>
            <Text style={styles.resultDescLight}>{result.dish_desc}</Text>
          </View>
          <View style={styles.resultBody}>
            <Text style={styles.resultLabel}>🍷 {t('moodScreen.cardDrink')}</Text>
            <Text style={styles.resultStrong}>{result.drink}</Text>
            <Text style={styles.resultDesc}>{result.drink_desc}</Text>
            <View style={styles.resultRow}>
              <View style={styles.resultCol}>
                <Text style={styles.resultLabel}>🎵 {t('moodScreen.cardMusic')}</Text>
                <Text style={styles.resultDesc}>{result.music_vibe}</Text>
              </View>
              <View style={styles.resultCol}>
                <Text style={styles.resultLabel}>🍰 {t('moodScreen.cardDessert')}</Text>
                <Text style={styles.resultDesc}>{result.dessert}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>✨ {t('moodScreen.share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.againBtn} onPress={reset} activeOpacity={0.85}>
            <Text style={styles.againBtnText}>🔄 {t('moodScreen.again')}</Text>
          </TouchableOpacity>
        </View>

        {restaurants.length > 0 && (
          <View style={styles.restCard} testID="restaurant-matches">
            <View style={styles.restHeader}>
              <Text style={styles.restEyebrow}>{t('moodScreen.bookTitle')}</Text>
              <Text style={styles.restSubtitle}>{t('moodScreen.bookSubtitle')}</Text>
            </View>
            {restaurants.map((r, i) => (
              <TouchableOpacity
                key={r.slug}
                onPress={() => bookAt(r)}
                activeOpacity={0.8}
                style={[styles.restRow, i < restaurants.length - 1 && styles.restRowBorder]}
              >
                <Text style={styles.restEmoji}>🍽️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.restName} numberOfLines={1}>{r.restaurant_name}</Text>
                  <Text style={styles.restMeta} numberOfLines={1}>
                    {[r.city, r.country].filter(Boolean).join(', ')}
                    {r.dining_style ? ` · ${r.dining_style}` : ''}
                  </Text>
                </View>
                <Text style={styles.restCta}>{t('moodScreen.bookCta')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <Text style={styles.eyebrow}>SavoryMind</Text>
      <Text style={styles.title}>{t('moodScreen.tagline')}</Text>
      <Text style={styles.subtitle}>{t('moodScreen.subtagline')}</Text>

      <Text style={styles.q}>{t('moodScreen.q1')}</Text>
      <View style={styles.chipWrap}>
        {MOODS.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, mood === m.id && styles.chipActive]}
            onPress={() => setMood(m.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.chipEmoji}>{m.emoji}</Text>
            <Text style={[styles.chipText, mood === m.id && styles.chipTextActive]}>
              {t(`moodScreen.mood_${m.id}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.q}>{t('moodScreen.q2')}</Text>
      <View style={styles.chipWrap}>
        {EXPERIENCES.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={[styles.chip, exp === e.id && styles.chipActive]}
            onPress={() => setExp(e.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.chipEmoji}>{e.emoji}</Text>
            <Text style={[styles.chipText, exp === e.id && styles.chipTextActive]}>
              {t(`moodScreen.exp_${e.id}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.q}>{t('moodScreen.q3')}</Text>
      <View style={styles.chipWrap}>
        {BUDGETS.map((b) => (
          <TouchableOpacity
            key={b}
            style={[styles.chip, budget === b && styles.chipActive]}
            onPress={() => setBudget(b)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, budget === b && styles.chipTextActive]}>
              {b === 'low' ? '€' : b === 'medium' ? '€€' : '€€€'} {t(`moodScreen.budget_${b}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.q}>{t('moodScreen.q5')}</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggle, !atHome && styles.toggleActive]}
          onPress={() => setAtHome(false)}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, !atHome && styles.toggleTextActive]}>🍽️ {t('moodScreen.goingOut')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, atHome && styles.toggleActive]}
          onPress={() => setAtHome(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, atHome && styles.toggleTextActive]}>🏠 {t('moodScreen.atHome')}</Text>
        </TouchableOpacity>
      </View>
      {!atHome && (
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder={t('moodScreen.locationPh')}
          placeholderTextColor={C.gray[400]}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitBtn, (!ready || loading) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={!ready || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>{t('moodScreen.tellMe')}</Text>}
      </TouchableOpacity>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow:       { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: C.consumer.primary, textAlign: 'center', marginBottom: 6 },
  title:         { fontSize: 26, fontWeight: '800', color: C.gray[900], textAlign: 'center', lineHeight: 33 },
  subtitle:      { fontSize: 13, color: C.gray[500], textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 19 },
  q:             { fontSize: 14, fontWeight: '700', color: C.gray[800], marginTop: 18, marginBottom: 10 },
  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: C.gray[200], backgroundColor: '#fff' },
  chipActive:    { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  chipEmoji:     { fontSize: 16 },
  chipText:      { fontSize: 13, fontWeight: '600', color: C.gray[600] },
  chipTextActive:{ color: C.consumer.primary },
  toggleRow:     { flexDirection: 'row', gap: 10 },
  toggle:        { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: C.gray[200], alignItems: 'center', backgroundColor: '#fff' },
  toggleActive:  { borderColor: C.consumer.primary, backgroundColor: C.consumer.light },
  toggleText:    { fontSize: 14, fontWeight: '600', color: C.gray[600] },
  toggleTextActive:{ color: C.consumer.primary },
  input:         { borderWidth: 1.5, borderColor: C.gray[200], borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginTop: 10, backgroundColor: '#fff', color: C.gray[900] },
  error:         { color: '#dc2626', fontSize: 13, textAlign: 'center', marginTop: 14 },
  submitBtn:     { backgroundColor: C.consumer.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled:{ opacity: 0.45 },
  submitText:    { color: '#fff', fontSize: 15, fontWeight: '800' },

  shareTitle:    { fontSize: 24, fontWeight: '800', color: C.gray[900], textAlign: 'center', lineHeight: 31, marginTop: 4 },
  shareSubtitle: { fontSize: 13, color: C.gray[500], textAlign: 'center', marginTop: 8, marginBottom: 20 },
  resultCard:    { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.gray[100], backgroundColor: '#fff' },
  resultHero:    { backgroundColor: C.consumer.primary, padding: 20 },
  resultLabelLight:{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  resultDish:    { fontSize: 24, fontWeight: '800', color: '#fff' },
  resultDescLight:{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 19 },
  resultBody:    { padding: 20 },
  resultLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: C.gray[500], marginBottom: 4 },
  resultStrong:  { fontSize: 16, fontWeight: '700', color: C.gray[900] },
  resultDesc:    { fontSize: 13, color: C.gray[600], marginTop: 3, lineHeight: 19 },
  resultRow:     { flexDirection: 'row', gap: 16, marginTop: 16 },
  resultCol:     { flex: 1 },
  actionRow:     { flexDirection: 'row', gap: 10, marginTop: 16 },
  shareBtn:      { flex: 1, backgroundColor: C.consumer.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  shareBtnText:  { color: '#fff', fontSize: 14, fontWeight: '800' },
  againBtn:      { flex: 1, borderWidth: 1.5, borderColor: C.gray[200], paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#fff' },
  againBtnText:  { color: C.gray[700], fontSize: 14, fontWeight: '700' },

  restCard:      { marginTop: 20, borderRadius: 20, borderWidth: 1, borderColor: C.consumer.border, backgroundColor: '#fff', overflow: 'hidden' },
  restHeader:    { padding: 16, borderBottomWidth: 1, borderBottomColor: C.gray[100] },
  restEyebrow:   { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: C.consumer.primary, marginBottom: 4 },
  restSubtitle:  { fontSize: 13, color: C.gray[500] },
  restRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  restRowBorder: { borderBottomWidth: 1, borderBottomColor: C.gray[100] },
  restEmoji:     { fontSize: 22 },
  restName:      { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  restMeta:      { fontSize: 12, color: C.gray[500], marginTop: 2 },
  restCta:       { fontSize: 12, fontWeight: '800', color: '#fff', backgroundColor: C.consumer.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
});
