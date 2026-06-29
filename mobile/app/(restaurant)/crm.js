import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

const EMPTY = { name: '', email: '', phone: '', notes: '', menu_sms_opt_in: false };

function Tag({ label }) {
  const isVip = label === 'vip';
  return (
    <Text style={[styles.tag, isVip ? styles.tagVip : styles.tagRegular]}>{isVip ? '⭐ VIP' : label}</Text>
  );
}

export default function CRMScreen() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const [atRisk, setAtRisk] = useState([]);
  const [wbBusy, setWbBusy] = useState(null);  // customer id being sent

  const load = async () => {
    try {
      const [c, s] = await Promise.all([api.getCustomers(), api.getCRMSummary()]);
      setCustomers(c); setSummary(s); setError(null);
      api.getAtRiskGuests().then((d) => setAtRisk(d.guests || [])).catch(() => {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  // One-tap win-back: draft + send in a single call (mobile keeps it simple —
  // the operator confirms via the native Alert before it actually sends).
  const winBack = (g) => {
    Alert.alert(
      t('crmPage.giWinBack'),
      t('crmPage.giConfirm', { name: g.name, days: g.days_since_visit }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('crmPage.giSendSms'), onPress: async () => {
          if (!g.phone) { Alert.alert(t('crmPage.giNoPhone')); return; }
          setWbBusy(g.id);
          try {
            await api.draftWinback(g.id, { send: true });
            setAtRisk((prev) => prev.filter((x) => x.id !== g.id));
          } catch (e) { Alert.alert(e.message || 'Failed'); }
          finally { setWbBusy(null); }
        }},
      ],
    );
  };

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Customer name is required.'); return; }
    setSaving(true); setFormError(null);
    try { await api.createCustomer(form); setShowForm(false); setForm(EMPTY); load(); }
    catch (e) { setFormError(e.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleRecordVisit = (c) => {
    Alert.prompt('Record Visit', `Spend amount for ${c.name} ($)`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Record', onPress: async (spend) => {
        const s = parseFloat(spend);
        if (!isNaN(s) && s >= 0) { await api.recordVisit(c.id, s); load(); }
      }},
    ], 'plain-text', '', 'decimal-pad');
  };

  const handleDelete = (c) => Alert.alert('Remove Customer', `Remove ${c.name} from CRM?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteCustomer(c.id); load(); } },
  ]);

  // Inline toggle for the daily menu SMS opt-in. Optimistic update so the
  // switch feels snappy; rolls back if the PATCH fails.
  const toggleMenuSms = async (c) => {
    const next = !c.menu_sms_opt_in;
    setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, menu_sms_opt_in: next } : x));
    try { await api.updateCustomer(c.id, { menu_sms_opt_in: next }); }
    catch (e) {
      setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, menu_sms_opt_in: !next } : x));
    }
  };

  if (loading) return <LoadingSpinner message="Loading customers..." color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('screens.crm.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {summary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {[
            { label: 'Total Customers', value: summary.total_customers },
            { label: 'VIP Regulars', value: summary.vip_count ?? customers.filter(c => (c.tags || '').includes('vip')).length },
            { label: 'Avg Spend', value: `$${(summary.avg_spend ?? 0).toFixed(0)}` },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {atRisk.length > 0 && (
        <View style={giStyles.panel}>
          <Text style={giStyles.eyebrow}>{t('crmPage.giEyebrow')}</Text>
          <Text style={giStyles.title}>🧠 {t('crmPage.giTitle')}</Text>
          {atRisk.slice(0, 4).map((g) => (
            <View key={g.id} style={giStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={giStyles.name}>{g.name}</Text>
                <Text style={giStyles.meta}>{t('crmPage.giLapsed', { days: g.days_since_visit })}</Text>
              </View>
              <Text style={giStyles.prob}>{Math.round(g.return_probability * 100)}%</Text>
              <TouchableOpacity style={giStyles.btn} onPress={() => winBack(g)} disabled={wbBusy === g.id}>
                {wbBusy === g.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={giStyles.btnText}>{t('crmPage.giWinBack')}</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TextInput style={styles.search} placeholder="Search by name or email..." value={search} onChangeText={setSearch} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {filtered.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={styles.name}>{c.name}</Text>
                {(c.tags || '').split(',').filter(Boolean).map(t => <Tag key={t} label={t.trim()} />)}
              </View>
              <Text style={styles.meta}>{c.total_visits} visits · ${(c.total_spend || 0).toFixed(0)} total · avg ${c.total_visits > 0 ? (c.total_spend / c.total_visits).toFixed(0) : 0}/visit</Text>
              {c.last_visit && <Text style={styles.sub}>Last visit: {c.last_visit}</Text>}
              {c.favorite_items && <Text style={styles.sub}>Favourites: {c.favorite_items}</Text>}
              <View style={styles.smsToggleRow}>
                <Text style={styles.smsToggleLabel}>{t('crmPage.colMenuSms')}</Text>
                <Switch
                  value={!!c.menu_sms_opt_in}
                  onValueChange={() => toggleMenuSms(c)}
                  disabled={!c.phone}
                  trackColor={{ true: C.restaurant.primary }}
                />
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.visitBtn} onPress={() => handleRecordVisit(c)}>
                <Text style={styles.visitBtnText}>+ Visit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(c)} style={{ padding: 4 }}>
                <Text>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {filtered.length === 0 && !search && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyTitle}>{t('crmPage.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('crmPage.emptyBody')}</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => { setForm(EMPTY); setFormError(null); setShowForm(true); }}>
              <Text style={styles.emptyCtaText}>+ {t('crmPage.addCustomer')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {filtered.length === 0 && !!search && <Text style={styles.empty}>{t('crmPage.noResults')}</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeScreen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
          {[
            { key: 'name', label: 'Full Name *' },
            { key: 'email', label: 'Email', kb: 'email-address' },
            { key: 'phone', label: 'Phone', kb: 'phone-pad' },
            { key: 'notes', label: 'Notes' },
          ].map(({ key, label, kb }) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={form[key]} onChangeText={v => set(key, v)} keyboardType={kb || 'default'} autoCapitalize={key === 'email' ? 'none' : 'words'} />
            </View>
          ))}
          <View style={styles.smsFormBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smsFormLabel}>{t('crmPage.menuSmsOptIn')}</Text>
              <Text style={styles.smsFormHint}>{t('crmPage.menuSmsOptInHint')}</Text>
            </View>
            <Switch
              value={!!form.menu_sms_opt_in}
              onValueChange={(v) => set('menu_sms_opt_in', v)}
              trackColor={{ true: C.restaurant.primary }}
            />
          </View>
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Customer</Text>}
          </TouchableOpacity>
        </SafeScreen>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  addBtn:       { backgroundColor: C.restaurant.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsRow:     { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  statCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', minWidth: 110, borderWidth: 1, borderColor: C.gray[100] },
  statValue:    { fontSize: 20, fontWeight: '800', color: C.restaurant.primary },
  statLabel:    { fontSize: 11, color: C.gray[500], marginTop: 2, textAlign: 'center' },
  search:       { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', borderWidth: 1, borderColor: C.gray[100] },
  name:         { fontSize: 15, fontWeight: '700', color: C.gray[900] },
  meta:         { fontSize: 12, color: C.gray[600] },
  sub:          { fontSize: 11, color: C.gray[400], marginTop: 2 },
  tag:          { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagVip:       { backgroundColor: '#fef3c7', color: '#92400e' },
  tagRegular:   { backgroundColor: C.gray[100], color: C.gray[600] },
  actions:      { alignItems: 'flex-end', gap: 8, justifyContent: 'space-between' },
  visitBtn:     { backgroundColor: C.restaurant.light, borderWidth: 1, borderColor: C.restaurant.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  visitBtnText: { fontSize: 12, fontWeight: '700', color: C.restaurant.text },
  empty:        { textAlign: 'center', color: C.gray[400], marginTop: 40, fontSize: 14 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  cancelText:   { fontSize: 16, color: C.gray[500] },
  label:        { fontSize: 13, fontWeight: '600', color: C.gray[700], marginBottom: 4 },
  input:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: C.gray[50] },
  formError:    { color: C.red, fontSize: 13, marginBottom: 12 },
  saveBtn:      { backgroundColor: C.restaurant.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  smsToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  smsToggleLabel: { fontSize: 11, color: C.gray[500] },
  smsFormBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  smsFormLabel: { fontSize: 13, fontWeight: '600', color: '#92400e' },
  smsFormHint:  { fontSize: 11, color: '#b45309', marginTop: 2 },
  emptyState:   { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyEmoji:   { fontSize: 36, marginBottom: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.gray[800], marginBottom: 4 },
  emptyBody:    { fontSize: 13, color: C.gray[500], textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  emptyCta:     { backgroundColor: C.restaurant.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const giStyles = StyleSheet.create({
  panel:   { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#faf5ff', borderColor: '#e9d5ff', borderWidth: 1, borderRadius: 14, padding: 12 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.6 },
  title:   { fontSize: 15, fontWeight: '800', color: C.gray[900], marginTop: 2, marginBottom: 8 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderColor: '#e9d5ff', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  name:    { fontSize: 13, fontWeight: '700', color: C.gray[900] },
  meta:    { fontSize: 11, color: C.gray[500], marginTop: 1 },
  prob:    { fontSize: 13, fontWeight: '800', color: '#7c3aed' },
  btn:     { backgroundColor: '#7c3aed', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, minWidth: 76, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
});
