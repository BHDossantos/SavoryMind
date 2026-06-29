import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Alert, ActivityIndicator, Share, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';

const STATUSES = ['All', 'confirmed', 'completed', 'cancelled'];
const STATUS_COLOR = { confirmed: C.green, completed: C.gray[400], cancelled: C.red };
const EMPTY = { customer_name: '', customer_email: '', customer_phone: '', date: '', time_slot: '', party_size: '2', table_number: '', notes: '' };

function Badge({ label, color, bg }) {
  return <Text style={[styles.badge, { color, borderColor: color, backgroundColor: bg || 'transparent' }]}>{label}</Text>;
}

// Booking link share card — parity with web ShareLinkWidget. Visible only
// when the restaurant has a slug. Native Share sheet beats clipboard on
// mobile, but we keep a copy-button fallback for users who want the URL.
function ShareLinkCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  if (!user?.slug) return null;
  const link = `https://savorymind.net/r/${user.slug}`;
  const message = t('bookingsPage.shareWhatsappMessage', { link });

  const onShare = () => Share.share({ message }).catch(() => {});
  const onCopy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.shareCard}>
      <Text style={styles.shareHeadline}>🔗 {t('bookingsPage.shareLinkHeadline')}</Text>
      <Text style={styles.shareSub}>{t('bookingsPage.shareLinkSubtitle')}</Text>
      <Text style={styles.shareLink} numberOfLines={1}>{link}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={styles.sharePrimary} onPress={onShare}>
          <Text style={styles.sharePrimaryText}>💬 {t('bookingsPage.shareWhatsapp')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareSecondary} onPress={onCopy}>
          <Text style={styles.shareSecondaryText}>{copied ? t('bookingsPage.shareCopied') : t('bookingsPage.shareCopy')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Operator-phone widget — parity with web SmsAlertWidget. Loose client-side
// E.164 check matches web; backend enforces with Twilio.
function SmsAlertCard() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [editing, setEditing] = useState(!user?.phone);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    const trimmed = phone.trim();
    if (trimmed && !/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      setErr(t('bookingsPage.smsPhoneInvalid'));
      return;
    }
    setSaving(true); setErr(null);
    try {
      await api.updateAuthProfile({ phone: trimmed || null });
      updateUser({ phone: trimmed || null });
      setEditing(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (!editing && user?.phone) {
    return (
      <View style={styles.smsActiveCard}>
        <Text style={styles.smsActiveText}>📱 {t('bookingsPage.smsAlertsActive', { phone: user.phone })}</Text>
        <TouchableOpacity onPress={() => setEditing(true)}>
          <Text style={styles.smsChangeLink}>{t('bookingsPage.smsChange')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.smsCard}>
      <Text style={styles.smsHeadline}>{t('bookingsPage.smsHeadline')}</Text>
      <Text style={styles.smsSub}>{t('bookingsPage.smsSubtitle')}</Text>
      <TextInput
        style={styles.smsInput}
        value={phone}
        onChangeText={setPhone}
        placeholder="+15555550100"
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={styles.smsPrimaryBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smsPrimaryText}>{t('bookingsPage.smsEnable')}</Text>}
        </TouchableOpacity>
        {user?.phone && (
          <TouchableOpacity onPress={() => { setPhone(user.phone); setEditing(false); setErr(null); }}>
            <Text style={styles.smsCancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {err && <Text style={styles.smsErr}>{err}</Text>}
    </View>
  );
}

// Today's menu publishing + 7-day attribution rollup — parity with web
// TodaysMenuWidget. Auto-expands when no menu set so the operator is
// nudged to publish.
function TodaysMenuCard() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [menu, setMenu] = useState(user?.menu_of_the_day || '');
  const [expanded, setExpanded] = useState(!user?.menu_of_the_day);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!expanded) return;
    api.getMenuBroadcastStats().then(setStats).catch(() => {});
  }, [expanded]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const trimmed = menu.trim().slice(0, 300);
      await api.updateAuthProfile({ menu_of_the_day: trimmed });
      updateUser({ menu_of_the_day: trimmed });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 4000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const clear = async () => {
    setSaving(true); setErr(null);
    try {
      await api.updateAuthProfile({ menu_of_the_day: '' });
      updateUser({ menu_of_the_day: '' });
      setMenu('');
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const today = new Date().toISOString().split('T')[0];
  const sentToday = user?.menu_sms_last_sent_date === today;

  return (
    <View style={styles.menuCard}>
      <TouchableOpacity onPress={() => setExpanded(v => !v)} style={styles.menuHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuHeadline}>🍽 {t('bookingsPage.menuHeadline')}</Text>
          <Text style={styles.menuSub}>{t('bookingsPage.menuSubtitle')}</Text>
        </View>
        <Text style={styles.menuChevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{ marginTop: 10 }}>
          {stats && stats.rounds > 0 && (
            <View style={styles.statsRow}>
              {[
                { label: t('bookingsPage.menuStatsSent'),     value: stats.sms_sent },
                { label: t('bookingsPage.menuStatsClicks'),   value: stats.clicks },
                { label: t('bookingsPage.menuStatsBookings'), value: stats.bookings },
              ].map((s) => (
                <View key={s.label} style={styles.statsCell}>
                  <Text style={styles.statsValue}>{s.value}</Text>
                  <Text style={styles.statsLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
          <TextInput
            style={styles.menuInput}
            value={menu}
            onChangeText={(v) => setMenu(v.slice(0, 300))}
            placeholder={t('bookingsPage.menuPlaceholder')}
            multiline
            numberOfLines={4}
            maxLength={300}
          />
          <View style={styles.menuMetaRow}>
            <Text style={styles.menuCount}>{t('bookingsPage.menuCharCount', { n: menu.length })}</Text>
            {sentToday && <Text style={styles.menuSent}>{t('bookingsPage.menuSentToday')}</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity style={styles.menuPrimaryBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.menuPrimaryText}>{t('bookingsPage.menuSave')}</Text>}
            </TouchableOpacity>
            {!!menu && (
              <TouchableOpacity onPress={clear} disabled={saving}>
                <Text style={styles.menuClear}>{t('bookingsPage.menuClear')}</Text>
              </TouchableOpacity>
            )}
            {savedMsg && <Text style={styles.menuSavedMsg}>✓ {t('bookingsPage.menuSaved')}</Text>}
          </View>
          {err && <Text style={styles.smsErr}>{err}</Text>}
        </View>
      )}
    </View>
  );
}

export default function BookingsScreen() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState(null);

  const load = async () => {
    try { const d = await api.getBookings(); setBookings(d); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const today = new Date().toISOString().slice(0, 10);
  const todayConfirmed = bookings.filter(b => b.date === today && b.status === 'confirmed');
  const covers = todayConfirmed.reduce((s, b) => s + b.party_size, 0);
  const filtered = bookings.filter(b => filter === 'All' || b.status === filter);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.customer_name.trim()) { setFormError('Guest name is required.'); return; }
    if (!form.date.match(/^\d{4}-\d{2}-\d{2}$/)) { setFormError('Date format: YYYY-MM-DD'); return; }
    if (!form.time_slot.trim()) { setFormError('Time is required (e.g. 19:00).'); return; }
    setSaving(true); setFormError(null);
    try {
      await api.createBooking({ ...form, party_size: parseInt(form.party_size) || 2, table_number: form.table_number ? parseInt(form.table_number) : null });
      setShowForm(false); setForm(EMPTY); load();
    } catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (b) => Alert.alert('Delete Booking', `Remove booking for ${b.customer_name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteBooking(b.id); load(); } },
  ]);

  if (loading) return <LoadingSpinner message="Loading bookings..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>{t('screens.bookings.title')}</Text>
            <Text style={styles.sub}>Today: {todayConfirmed.length} bookings · {covers} covers</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <ShareLinkCard />
          <SmsAlertCard />
          <TodaysMenuCard />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUSES.map(s => (
            <TouchableOpacity key={s} style={[styles.pill, filter === s && styles.pillActive]} onPress={() => setFilter(s)}>
              <Text style={[styles.pillText, filter === s && styles.pillTextActive]}>
                {s === 'All' ? 'All' : s[0].toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 16 }}>
          {filtered.map(b => (
            <View key={b.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                    <Text style={styles.name}>{b.customer_name}</Text>
                    {b.source === 'menu_sms' && (
                      <Badge label={`🍽 ${t('bookingsPage.menuSmsBadge')}`} color={C.restaurant.primary} bg="#fef3c7" />
                    )}
                  </View>
                  <Badge label={b.status} color={STATUS_COLOR[b.status] || C.gray[400]} />
                </View>
                <Text style={styles.meta}>{b.date} · {b.time_slot} · {b.party_size} guests{b.table_number ? ` · Table ${b.table_number}` : ''}</Text>
                {b.notes ? <Text style={styles.note}>{b.notes}</Text> : null}
                {b.customer_email ? <Text style={styles.contact}>{b.customer_email}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleDelete(b)} style={{ padding: 4, alignSelf: 'flex-start' }}>
                <Text>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
          {filtered.length === 0 && <Text style={styles.empty}>No bookings found.</Text>}
        </View>
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Booking</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
          {[
            { key: 'customer_name', label: 'Guest Name *' },
            { key: 'customer_email', label: 'Email' },
            { key: 'customer_phone', label: 'Phone' },
            { key: 'date', label: 'Date * (YYYY-MM-DD)' },
            { key: 'time_slot', label: 'Time * (e.g. 19:00)' },
            { key: 'party_size', label: 'Party Size', kb: 'number-pad' },
            { key: 'table_number', label: 'Table Number', kb: 'number-pad' },
            { key: 'notes', label: 'Notes / Special Requests' },
          ].map(({ key, label, kb }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={form[key]} onChangeText={v => set(key, v)} keyboardType={kb || 'default'} />
            </View>
          ))}
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Booking</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:          { fontSize: 12, color: C.gray[500], marginTop: 2 },
  addBtn:       { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterRow:    { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  pill:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  pillActive:   { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  pillText:     { fontSize: 13, color: C.gray[600], fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', borderWidth: 1, borderColor: C.gray[100] },
  name:         { fontSize: 15, fontWeight: '700', color: C.gray[900], marginRight: 6 },
  badge:        { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  meta:         { fontSize: 12, color: C.gray[500] },
  note:         { fontSize: 12, color: C.gray[600], marginTop: 4, fontStyle: 'italic' },
  contact:      { fontSize: 11, color: C.gray[400], marginTop: 2 },
  empty:        { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  cancelText:   { fontSize: 16, color: C.gray[500] },
  label:        { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:    { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:      { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Share link card
  shareCard:    { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  shareHeadline:{ fontSize: 13, fontWeight: '700', color: '#9a3412' },
  shareSub:     { fontSize: 11, color: '#c2410c', marginTop: 2 },
  shareLink:    { fontSize: 11, color: C.gray[700], marginTop: 6, backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  sharePrimary: { flex: 1, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  sharePrimaryText:{ color: '#fff', fontWeight: '700', fontSize: 12 },
  shareSecondary:{ flex: 1, backgroundColor: '#ea580c', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  shareSecondaryText:{ color: '#fff', fontWeight: '700', fontSize: 12 },

  // SMS alert card
  smsCard:      { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  smsHeadline:  { fontSize: 13, fontWeight: '700', color: '#9a3412' },
  smsSub:       { fontSize: 11, color: '#c2410c', marginTop: 2 },
  smsInput:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginTop: 8 },
  smsPrimaryBtn:{ backgroundColor: '#ea580c', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  smsPrimaryText:{ color: '#fff', fontWeight: '700', fontSize: 12 },
  smsCancel:    { color: C.gray[500], fontSize: 12, paddingVertical: 8 },
  smsErr:       { color: C.red, fontSize: 11, marginTop: 6 },
  smsActiveCard:{ backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smsActiveText:{ fontSize: 12, color: '#166534', flex: 1 },
  smsChangeLink:{ fontSize: 11, color: '#15803d', fontWeight: '600', textDecorationLine: 'underline' },

  // Today's menu card
  menuCard:     { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  menuHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuHeadline: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  menuSub:      { fontSize: 11, color: '#b45309', marginTop: 2 },
  menuChevron:  { fontSize: 14, color: '#b45309' },
  menuInput:    { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  menuMetaRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
  menuCount:    { fontSize: 11, color: '#b45309' },
  menuSent:     { fontSize: 11, color: '#b45309', fontStyle: 'italic' },
  menuPrimaryBtn:{ backgroundColor: '#d97706', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  menuPrimaryText:{ color: '#fff', fontWeight: '700', fontSize: 12 },
  menuClear:    { color: '#b45309', fontSize: 12, paddingHorizontal: 8 },
  menuSavedMsg: { color: '#15803d', fontSize: 11, fontWeight: '600' },

  // Stats row
  statsRow:     { flexDirection: 'row', gap: 6, marginBottom: 10 },
  statsCell:    { flex: 1, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', paddingVertical: 8, alignItems: 'center' },
  statsValue:   { fontSize: 18, fontWeight: '800', color: '#92400e' },
  statsLabel:   { fontSize: 9, color: '#b45309', textTransform: 'uppercase', fontWeight: '600', marginTop: 2 },
});
