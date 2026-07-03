import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const STATUS_STYLE = {
  confirmed: { bg: '#dcfce7', text: '#16a34a' },
  pending:   { bg: '#fef3c7', text: '#d97706' },
  cancelled: { bg: '#f3f4f6', text: '#9ca3af' },
};

export default function BookScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [bookings, setBookings]     = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery]           = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [showPast, setShowPast]     = useState(false);
  const [reviewing, setReviewing]   = useState(null); // booking being reviewed
  const [myReviews, setMyReviews]   = useState([]);

  const load = async () => {
    try { setBookings(await api.getDinerBookings()); } catch {}
    try { setMyReviews(await api.getMyDinerReviews()); } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const openSearch = async () => {
    setShowSearch(true);
    setSearching(true);
    try { setRestaurants(await api.discoverRestaurants({})); } catch { setRestaurants([]); }
    finally { setSearching(false); }
  };

  const handleCancel = (b) =>
    Alert.alert('Cancel Booking', `Cancel your booking at ${b.restaurant_name}?`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => { await api.cancelDinerBooking(b.id); load(); } },
    ]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? restaurants.filter((r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) ||
        (r.cuisine || []).some((c) => c.toLowerCase().includes(q)))
    : restaurants;

  const reviewedBookings = new Set(myReviews.map((r) => r.booking_id));
  const upcoming = bookings.filter((b) => b.status !== 'cancelled');
  const past     = bookings.filter((b) => b.status === 'cancelled');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t('screens.book.title')}</Text>
          {bookings.length > 0 && <Text style={styles.sub}>{upcoming.length} upcoming · {past.length} past</Text>}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openSearch}>
          <Text style={styles.addBtnText}>+ Book</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Upcoming */}
        {upcoming.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancel={handleCancel}
                onReview={b.restaurant_user_id && !reviewedBookings.has(b.id) ? () => setReviewing(b) : null}
              />
            ))}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No upcoming bookings</Text>
            <Text style={styles.emptySub}>Tap "+ Book" to find a restaurant and reserve a table</Text>
          </View>
        )}

        {/* Past / cancelled */}
        {past.length > 0 && (
          <>
            <TouchableOpacity style={styles.pastToggle} onPress={() => setShowPast((s) => !s)}>
              <Text style={styles.pastToggleText}>{showPast ? '▲' : '▼'} Past Bookings ({past.length})</Text>
            </TouchableOpacity>
            {showPast && past.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Restaurant picker — real platform restaurants, live availability
          happens on the detail screen this pushes into. */}
      <Modal visible={showSearch} animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 56 }}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Find a restaurant</Text>
            <TouchableOpacity onPress={() => { setShowSearch(false); setQuery(''); }} hitSlop={12}>
              <Text style={styles.closeLink}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, city, or cuisine…"
            autoFocus
          />
          {searching ? (
            <ActivityIndicator color={C.diner.primary} style={{ marginTop: 32 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {filtered.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🍽️</Text>
                  <Text style={styles.emptyText}>No restaurants found</Text>
                  <Text style={styles.emptySub}>Try a different search — new restaurants join every week.</Text>
                </View>
              )}
              {filtered.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.restaurantCard}
                  onPress={() => {
                    setShowSearch(false); setQuery('');
                    router.push(`/(diner)/restaurant/${r.id}`);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.restaurant}>{r.name}</Text>
                    <Text style={styles.bookingMeta}>
                      {(r.cuisine || []).slice(0, 3).join(' · ') || r.dining_style}
                      {r.city ? ` · ${r.city}` : ''}
                    </Text>
                    {r.review_count > 0 && (
                      <Text style={styles.rating}>★ {r.rating} ({r.review_count})</Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <ReviewModal booking={reviewing} onClose={(saved) => { setReviewing(null); if (saved) load(); }} />
    </View>
  );
}

function BookingCard({ booking: b, onCancel, onReview }) {
  const s = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
  return (
    <View style={[styles.bookingCard, b.status === 'cancelled' && styles.bookingCardDim]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.restaurant}>{b.restaurant_name}</Text>
        <Text style={styles.bookingMeta}>{b.date || b.booking_date} at {b.time || b.booking_time} · {b.party_size} guests</Text>
        {b.special_requests ? <Text style={styles.requests}>"{b.special_requests}"</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: s.text }}>{b.status}</Text>
        </View>
        {onReview && (
          <TouchableOpacity onPress={onReview}>
            <Text style={styles.reviewLink}>★ Review</Text>
          </TouchableOpacity>
        )}
        {onCancel && b.status !== 'cancelled' && (
          <TouchableOpacity onPress={() => onCancel(b)}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ReviewModal({ booking, onClose }) {
  const [rating, setRating]   = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      await api.createDinerReview({
        restaurant_user_id: booking.restaurant_user_id,
        booking_id: booking.id,
        rating,
        comment: comment.trim(),
      });
      setComment(''); setRating(5);
      onClose(true);
    } catch (e) {
      setError(e.message || 'Could not submit review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!booking} animationType="fade" transparent onRequestClose={() => onClose(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.formTitle}>How was {booking?.restaurant_name}?</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={{ fontSize: 30, color: n <= rating ? '#f59e0b' : C.gray[300] }}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.searchInput, { marginHorizontal: 0, minHeight: 70 }]}
            value={comment}
            onChangeText={setComment}
            placeholder="Tell other diners about it (optional)"
            multiline
          />
          {error && <Text style={styles.formError}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: C.gray[200] }]} onPress={() => onClose(false)}>
              <Text style={[styles.saveBtnText, { color: C.gray[700] }]}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:           { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:             { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:          { backgroundColor: C.diner.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  formTitle:       { fontSize: 16, fontWeight: '800', color: C.gray[900], marginBottom: 14 },
  formError:       { color: C.red, fontSize: 13, marginTop: 8 },
  saveBtn:         { backgroundColor: C.diner.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: C.gray[700], marginBottom: 10 },
  bookingCard:     { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  bookingCardDim:  { opacity: 0.65 },
  restaurant:      { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  bookingMeta:     { fontSize: 13, color: C.gray[500], marginTop: 3 },
  requests:        { fontSize: 12, color: C.gray[400], marginTop: 4, fontStyle: 'italic' },
  rating:          { fontSize: 12, color: '#b45309', fontWeight: '700', marginTop: 4 },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cancelLink:      { fontSize: 12, color: C.red },
  reviewLink:      { fontSize: 12, color: '#b45309', fontWeight: '700' },
  pastToggle:      { paddingVertical: 12, alignItems: 'center' },
  pastToggleText:  { fontSize: 13, fontWeight: '600', color: C.gray[500] },
  empty:           { alignItems: 'center', marginTop: 40 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 17, fontWeight: '700', color: C.gray[700] },
  emptySub:        { fontSize: 13, color: C.gray[500], marginTop: 6, textAlign: 'center' },
  searchHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  searchTitle:     { fontSize: 20, fontWeight: '800', color: C.gray[900] },
  closeLink:       { fontSize: 14, color: C.gray[500], fontWeight: '600' },
  searchInput:     { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: '#fff', marginHorizontal: 16 },
  restaurantCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  chevron:         { fontSize: 24, color: C.gray[300], marginLeft: 8 },
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard:       { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
});
