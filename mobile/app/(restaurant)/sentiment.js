import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import SimpleBarChart from '../../components/SimpleBarChart';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { useFocusEffect } from 'expo-router';

function Badge({ label }) {
  const colors = { positive: { bg: '#dcfce7', text: '#16a34a' }, negative: { bg: '#fee2e2', text: '#dc2626' }, neutral: { bg: '#f1f5f9', text: '#64748b' } };
  const s = colors[label] || colors.neutral;
  return <Text style={[styles.badge, { backgroundColor: s.bg, color: s.text }]}>{label}</Text>;
}

export default function SentimentScreen() {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  // Claude-extracted top complaints / praise / themes / tone — populated
  // by the new /api/reviews/themes endpoint. Empty top_* lists when
  // ANTHROPIC_API_KEY isn't set on the backend.
  const [themes, setThemes] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_name: '', menu_item: '', rating: '5', comment: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try {
      const [items, r, s, t] = await Promise.all([
        api.getMenuItems(),
        api.getReviews(),
        api.getSentimentSummary(),
        api.getReviewThemes().catch(() => null),  // never block the page on the optional themes endpoint
      ]);
      setMenuItems(items); setReviews(r); setSummary(s); setThemes(t); setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = reviews.filter((r) => filter === 'all' || r.sentiment_label === filter);

  const handleSubmit = async () => {
    if (!form.menu_item) { setFormError('Select a menu item.'); return; }
    const rating = parseInt(form.rating);
    if (rating < 1 || rating > 5) { setFormError('Rating must be 1–5.'); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createReview({ ...form, rating });
      setShowForm(false);
      setForm({ customer_name: '', menu_item: '', rating: '5', comment: '' });
      load();
    } catch (e) { setFormError(e.message || 'Submit failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (r) =>
    Alert.alert('Delete Review', `Delete review by "${r.customer_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteReview(r.id); load(); } },
    ]);

  if (loading) return <LoadingSpinner message="Loading reviews..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const barData = summary ? [
    { label: 'Positive', value: summary.positive_count, color: C.green },
    { label: 'Neutral',  value: summary.neutral_count,  color: C.gray[400] },
    { label: 'Negative', value: summary.negative_count, color: C.red },
  ] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Sentiment</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ Review</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}><Text style={styles.summaryVal}>{summary.total_reviews}</Text><Text style={styles.summaryLab}>Total</Text></View>
              <View style={styles.summaryItem}><Text style={[styles.summaryVal, { color: C.green }]}>{summary.positive_count}</Text><Text style={styles.summaryLab}>Positive</Text></View>
              <View style={styles.summaryItem}><Text style={styles.summaryVal}>{summary.neutral_count}</Text><Text style={styles.summaryLab}>Neutral</Text></View>
              <View style={styles.summaryItem}><Text style={[styles.summaryVal, { color: C.red }]}>{summary.negative_count}</Text><Text style={styles.summaryLab}>Negative</Text></View>
            </View>
            <SimpleBarChart data={barData} height={120} />
          </View>
        )}

        {/* Theme panel — only render when at least one review has been
            enriched (otherwise it's a 0-count distraction). The numeric
            sentiment summary above is what restaurants see day-to-day;
            this panel is the actionable layer ("12 reviews mention
            'wait time'"). */}
        {themes && themes.enriched_reviews > 0 && (
          <View style={styles.themesCard}>
            <Text style={styles.themesHeading}>What guests are talking about</Text>
            <Text style={styles.themesSub}>
              From {themes.enriched_reviews} of {themes.total_reviews} reviews
            </Text>

            {themes.top_complaints && themes.top_complaints.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.themesGroup}>Top complaints</Text>
                <View style={styles.tagRow}>
                  {themes.top_complaints.map((c) => (
                    <View key={c.label} style={[styles.tag, styles.tagRed]}>
                      <Text style={styles.tagLabel}>{c.label}</Text>
                      <Text style={styles.tagCount}>×{c.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {themes.top_praise && themes.top_praise.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.themesGroup}>Top praise</Text>
                <View style={styles.tagRow}>
                  {themes.top_praise.map((p) => (
                    <View key={p.label} style={[styles.tag, styles.tagGreen]}>
                      <Text style={styles.tagLabel}>{p.label}</Text>
                      <Text style={styles.tagCount}>×{p.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {themes.top_themes && themes.top_themes.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.themesGroup}>Themes</Text>
                <View style={styles.tagRow}>
                  {themes.top_themes.map((t) => (
                    <View key={t.label} style={[styles.tag, styles.tagBlue]}>
                      <Text style={styles.tagLabel}>{t.label}</Text>
                      <Text style={styles.tagCount}>×{t.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {['all', 'positive', 'neutral', 'negative'].map((f) => (
            <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Reviews */}
        {filtered.map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewer}>{r.customer_name} <Text style={styles.reviewItem}>· {r.menu_item}</Text></Text>
                <Text style={styles.stars}>{'⭐'.repeat(r.rating)}</Text>
                <Text style={styles.comment}>{r.comment}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Badge label={r.sentiment_label} />
                  <Text style={styles.score}>{r.sentiment_score.toFixed(2)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(r)} style={{ padding: 4 }}><Text>🗑️</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>No reviews match this filter.</Text>}
      </ScrollView>

      {/* Add Review Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={styles.modalTitle}>Add Review</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={{ color: C.gray[500] }}>Cancel</Text></TouchableOpacity>
          </View>
          {[{ key: 'customer_name', label: 'Customer Name' }, { key: 'rating', label: 'Rating (1–5)', kb: 'number-pad' }, { key: 'comment', label: 'Comment', multi: true }].map(({ key, label, kb, multi }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={[styles.input, multi && { height: 80, textAlignVertical: 'top' }]} value={form[key]} onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))} keyboardType={kb || 'default'} multiline={multi} />
            </View>
          ))}
          <Text style={styles.label}>Menu Item</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {menuItems.map((i) => (
              <TouchableOpacity key={i.id} style={[styles.filterBtn, form.menu_item === i.name && styles.filterBtnActive]} onPress={() => setForm((f) => ({ ...f, menu_item: i.name }))}>
                <Text style={[styles.filterText, form.menu_item === i.name && styles.filterTextActive]}>{i.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Submit Review</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:         { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  addBtn:        { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  themesCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.gray[100] },
  themesHeading: { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  themesSub:     { fontSize: 12, color: C.gray[500], marginTop: 2 },
  themesGroup:   { fontSize: 11, fontWeight: '700', color: C.gray[600], textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  tagRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagRed:        { backgroundColor: '#fee2e2' },
  tagGreen:      { backgroundColor: '#dcfce7' },
  tagBlue:       { backgroundColor: '#dbeafe' },
  tagLabel:      { fontSize: 12, fontWeight: '600', color: C.gray[800] },
  tagCount:      { fontSize: 11, fontWeight: '700', color: C.gray[500] },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  summaryItem:   { alignItems: 'center' },
  summaryVal:    { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  summaryLab:    { fontSize: 11, color: C.gray[500], marginTop: 2 },
  filterBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], marginRight: 8, backgroundColor: '#fff' },
  filterBtnActive:{ backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  filterText:    { fontSize: 13, color: C.gray[600], fontWeight: '500', textTransform: 'capitalize' },
  filterTextActive:{ color: '#fff', fontWeight: '700' },
  reviewCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  reviewer:      { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  reviewItem:    { fontWeight: '400', color: C.gray[500] },
  stars:         { fontSize: 13, marginTop: 3 },
  comment:       { fontSize: 13, color: C.gray[600], marginTop: 6, lineHeight: 19 },
  score:         { fontSize: 12, color: C.gray[400] },
  badge:         { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, textTransform: 'capitalize' },
  empty:         { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  label:         { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:         { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:     { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:       { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
});
