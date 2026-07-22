import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { formatEuro } from '../../utils/euro';

// Incident taxonomy — icon + accent per type. Keeps the quick-log chips
// glanceable during service (owner picks by icon, not by reading).
const TYPES = [
  { key: 'waste',       icon: '🗑️' },
  { key: 'portioning',  icon: '⚖️' },
  { key: 'speed',       icon: '⏱️' },
  { key: 'punctuality', icon: '🕐' },
  { key: 'quality',     icon: '⭐' },
];

// Optional detail expander — cause tags per type map to loss coefficients
// on the backend. Collapsed by default so the fast path stays 3 taps.
const CAUSE_TAGS = [
  'over_portioning', 'cooking_error', 'spoilage', 'prep_waste',
  'slow_ticket', 'late_arrival', 'recipe_deviation', 'plating',
];
const UNITS = ['kg', 'g', 'pz', 'l'];

const PRIORITY_COLOR = { high: C.red, medium: C.amber, low: C.green };

export default function CoachingScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // ── Quick-log state ──────────────────────────────────────────────
  const [staff, setStaff]       = useState([]);
  const [staffId, setStaffId]   = useState(null);
  const [type, setType]         = useState(null);
  const [amount, setAmount]     = useState('');
  const [logging, setLogging]   = useState(false);
  const [flash, setFlash]       = useState(false);   // "✓ Registrato" flash
  const [logError, setLogError] = useState(null);
  const amountRef = useRef(null);

  // Optional details (collapsed by default)
  const [showDetails, setShowDetails] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit]         = useState(null);
  const [tags, setTags]         = useState([]);
  const [notes, setNotes]       = useState('');

  // ── Screen load state ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Plans state ──────────────────────────────────────────────────
  const [plans, setPlans]           = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]     = useState(null);
  const [approving, setApproving]   = useState(null);

  const load = async () => {
    try {
      const [s, p] = await Promise.all([api.getStaff(), api.getCoachingPlans()]);
      setStaff(s || []);
      setPlans(p || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const staffName = (id) => staff.find((m) => m.id === id)?.name || '';

  const toggleTag = (tg) =>
    setTags((cur) => (cur.includes(tg) ? cur.filter((x) => x !== tg) : [...cur, tg]));

  const canLog = staffId != null && type != null && amount.trim() !== '' && !logging;

  const handleLog = async () => {
    // Normalise the Italian decimal comma the numeric keypad may produce.
    const euro = parseFloat(String(amount).replace(',', '.'));
    if (staffId == null || !type || !Number.isFinite(euro)) return;
    setLogging(true);
    setLogError(null);
    const qty = quantity.trim() ? parseFloat(String(quantity).replace(',', '.')) : undefined;
    try {
      await api.logIncident({
        staff_id: staffId,
        type,
        euro_impact: euro,
        ...(Number.isFinite(qty) ? { quantity: qty } : {}),
        ...(unit ? { unit } : {}),
        ...(tags.length ? { cause_tags: tags } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      // Keep staff + type selected for rapid repeat; clear only the number
      // and the optional details. Keep focus on the amount input.
      setAmount('');
      setQuantity('');
      setUnit(null);
      setTags([]);
      setNotes('');
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
      amountRef.current?.focus();
    } catch (e) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      setLogError(e.message || t('coaching.logError'));
    } finally {
      setLogging(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await api.generateCoachingPlans();
      // Endpoint may return the new drafts, or nothing — refetch to be safe.
      if (Array.isArray(res) && res.length) setPlans(res);
      else setPlans(await api.getCoachingPlans());
    } catch (e) {
      setGenError(e.message || t('coaching.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (plan) => {
    setApproving(plan.id);
    try {
      await api.approveCoachingPlan(plan.id);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setPlans((cur) => cur.map((p) => (p.id === plan.id ? { ...p, status: 'active' } : p)));
    } catch (e) {
      setGenError(e.message || t('coaching.approveError'));
    } finally {
      setApproving(null);
    }
  };

  if (loading) return <LoadingSpinner message={t('coaching.loading')} color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  const drafts   = plans.filter((p) => p.status === 'draft');
  const activePl = plans.filter((p) => p.status === 'active' || p.status === 'completed');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('coaching.title')}</Text>
        <Text style={styles.sub}>{t('coaching.subtitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ══ HERO — QUICK LOG (≤3 taps + one number) ══ */}
        <View style={q.hero}>
          <Text style={q.heroEyebrow}>{t('coaching.quickLogEyebrow')}</Text>
          <Text style={q.heroTitle}>{t('coaching.quickLogTitle')}</Text>

          {/* Tap 1 — who */}
          <Text style={q.step}>{t('coaching.stepWho')}</Text>
          {staff.length === 0 ? (
            <Text style={q.emptyStaff}>{t('coaching.noStaff')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {staff.map((m) => {
                const on = staffId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`staff-chip-${m.id}`}
                    style={[q.staffChip, on && q.staffChipOn]}
                    onPress={() => setStaffId(m.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[q.staffChipText, on && q.staffChipTextOn]} numberOfLines={1}>{m.name}</Text>
                    {m.role ? <Text style={[q.staffChipRole, on && q.staffChipTextOn]}>{m.role}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Tap 2 — what */}
          <Text style={q.step}>{t('coaching.stepWhat')}</Text>
          <View style={q.typeGrid}>
            {TYPES.map((ty) => {
              const on = type === ty.key;
              return (
                <TouchableOpacity
                  key={ty.key}
                  testID={`type-chip-${ty.key}`}
                  style={[q.typeChip, on && q.typeChipOn]}
                  onPress={() => setType(ty.key)}
                  activeOpacity={0.8}
                >
                  <Text style={q.typeIcon}>{ty.icon}</Text>
                  <Text style={[q.typeLabel, on && q.typeLabelOn]}>{t(`coaching.type.${ty.key}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tap 3 — how much (one number) + Registra */}
          <Text style={q.step}>{t('coaching.stepHowMuch')}</Text>
          <View style={q.amountRow}>
            <Text style={q.euroSign}>€</Text>
            <TextInput
              ref={amountRef}
              testID="amount-input"
              style={q.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.gray[300]}
              returnKeyType="done"
              onSubmitEditing={() => { if (canLog) handleLog(); }}
            />
          </View>

          {logError ? <Text style={q.logError}>{logError}</Text> : null}

          <TouchableOpacity
            testID="log-btn"
            style={[q.logBtn, !canLog && q.logBtnDisabled]}
            onPress={handleLog}
            disabled={!canLog}
            activeOpacity={0.85}
          >
            {logging
              ? <ActivityIndicator color="#fff" />
              : <Text style={q.logBtnText}>{t('coaching.logButton')}</Text>}
          </TouchableOpacity>

          {flash && (
            <View testID="log-flash" style={q.flash}>
              <Text style={q.flashText}>
                {t('coaching.logged', { name: staffName(staffId) })}
              </Text>
            </View>
          )}

          {/* Optional details — collapsed so the fast path is 3 taps */}
          <TouchableOpacity
            testID="details-toggle"
            style={q.detailsToggle}
            onPress={() => setShowDetails((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={q.detailsToggleText}>
              {showDetails ? '▾ ' : '▸ '}{t('coaching.detailsToggle')}
            </Text>
          </TouchableOpacity>

          {showDetails && (
            <View style={q.details}>
              <Text style={q.detailLabel}>{t('coaching.quantity')}</Text>
              <View style={q.qtyRow}>
                <TextInput
                  testID="quantity-input"
                  style={q.qtyInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.gray[300]}
                />
                <View style={q.unitRow}>
                  {UNITS.map((u) => {
                    const on = unit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[q.unitChip, on && q.unitChipOn]}
                        onPress={() => setUnit(on ? null : u)}
                      >
                        <Text style={[q.unitChipText, on && q.unitChipTextOn]}>{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={q.detailLabel}>{t('coaching.causeTags')}</Text>
              <View style={q.tagWrap}>
                {CAUSE_TAGS.map((tg) => {
                  const on = tags.includes(tg);
                  return (
                    <TouchableOpacity
                      key={tg}
                      style={[q.tag, on && q.tagOn]}
                      onPress={() => toggleTag(tg)}
                    >
                      <Text style={[q.tagText, on && q.tagTextOn]}>{t(`coaching.cause.${tg}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={q.detailLabel}>{t('coaching.notes')}</Text>
              <TextInput
                testID="notes-input"
                style={q.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('coaching.notesPlaceholder')}
                placeholderTextColor={C.gray[300]}
                multiline
              />
            </View>
          )}
        </View>

        {/* ══ PLANS ══ */}
        <View style={p.section}>
          <View style={p.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={p.sectionTitle}>{t('coaching.plansTitle')}</Text>
              <Text style={p.sectionSub}>{t('coaching.plansSub')}</Text>
            </View>
            <TouchableOpacity
              testID="generate-btn"
              style={[p.genBtn, generating && p.genBtnBusy]}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.85}
            >
              {generating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={p.genBtnText}>{t('coaching.generateButton')}</Text>}
            </TouchableOpacity>
          </View>

          {genError ? <Text style={p.genError}>{genError}</Text> : null}

          {plans.length === 0 && !generating && (
            <View testID="plans-empty" style={p.empty}>
              <Text style={p.emptyIcon}>🎯</Text>
              <Text style={p.emptyTitle}>{t('coaching.plansEmptyTitle')}</Text>
              <Text style={p.emptyBody}>{t('coaching.plansEmptyBody')}</Text>
            </View>
          )}

          {drafts.length > 0 && (
            <Text style={p.groupLabel}>{t('coaching.draftsLabel', { count: drafts.length })}</Text>
          )}
          {drafts.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              staffName={staffName(plan.staff_id)}
              locale={locale}
              onApprove={() => handleApprove(plan)}
              approving={approving === plan.id}
              t={t}
            />
          ))}

          {activePl.length > 0 && (
            <Text style={p.groupLabel}>{t('coaching.activeLabel', { count: activePl.length })}</Text>
          )}
          {activePl.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              staffName={staffName(plan.staff_id)}
              locale={locale}
              t={t}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PlanCard({ plan, staffName, locale, onApprove, approving, t }) {
  const prio = plan.priority || 'medium';
  const prioColor = PRIORITY_COLOR[prio] || C.amber;
  const isDraft = plan.status === 'draft';
  const actions = Array.isArray(plan.actions) ? plan.actions : [];

  return (
    <View testID={`plan-${plan.id}`} style={p.card}>
      <View style={p.cardHead}>
        <View style={{ flex: 1 }}>
          <View style={p.cardTitleRow}>
            <View style={[p.prioDot, { backgroundColor: prioColor }]} />
            <Text style={p.cardStaff}>{staffName || t('coaching.unknownStaff')}</Text>
            <Text style={[p.prioTag, { color: prioColor }]}>{t(`coaching.priority.${prio}`)}</Text>
          </View>
          <Text style={p.cardTitle}>{plan.title}</Text>
        </View>
        {plan.euro_impact_total > 0 && (
          <Text style={p.cardEuro}>{formatEuro(plan.euro_impact_total, locale, { decimals: 2 })}</Text>
        )}
      </View>

      {plan.summary ? <Text style={p.cardSummary}>{plan.summary}</Text> : null}

      {actions.map((a, i) => (
        <View key={i} style={p.action}>
          <Text style={p.actionCheck}>{a.done ? '☑' : '☐'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[p.actionText, a.done && p.actionDone]}>{a.text}</Text>
            {a.due_hint ? <Text style={p.actionHint}>{a.due_hint}</Text> : null}
          </View>
        </View>
      ))}

      <View style={p.cardFoot}>
        {plan.generated_by_model ? (
          <Text style={p.aiBadge}>{t('coaching.aiBadge', { model: plan.generated_by_model })}</Text>
        ) : (
          <Text style={p.aiBadge}>{t('coaching.autoBadge')}</Text>
        )}
        {isDraft ? (
          <TouchableOpacity
            testID={`approve-${plan.id}`}
            style={[p.approveBtn, approving && p.approveBtnBusy]}
            onPress={onApprove}
            disabled={approving}
            activeOpacity={0.85}
          >
            {approving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={p.approveBtnText}>{t('coaching.approve')}</Text>}
          </TouchableOpacity>
        ) : (
          <Text style={p.statusTag}>
            {plan.status === 'completed' ? t('coaching.statusCompleted') : t('coaching.statusActive')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Quick-log styles ──────────────────────────────────────────────
const q = StyleSheet.create({
  hero:            { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.restaurant.border, marginBottom: 20 },
  heroEyebrow:     { fontSize: 10, fontWeight: '800', color: C.restaurant.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle:       { fontSize: 18, fontWeight: '800', color: C.gray[900], marginTop: 2, marginBottom: 4 },
  step:            { fontSize: 12, fontWeight: '700', color: C.gray[500], marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  emptyStaff:      { fontSize: 13, color: C.gray[400], fontStyle: 'italic', paddingVertical: 8 },

  staffChip:       { minWidth: 88, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.gray[200], backgroundColor: '#fff' },
  staffChipOn:     { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  staffChipText:   { fontSize: 15, fontWeight: '700', color: C.gray[800] },
  staffChipRole:   { fontSize: 10, color: C.gray[400], marginTop: 1 },
  staffChipTextOn: { color: '#fff' },

  typeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:        { flexGrow: 1, minWidth: '30%', alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.gray[200], backgroundColor: '#fff' },
  typeChipOn:      { backgroundColor: C.restaurant.light, borderColor: C.restaurant.primary },
  typeIcon:        { fontSize: 26, marginBottom: 4 },
  typeLabel:       { fontSize: 12, fontWeight: '700', color: C.gray[600] },
  typeLabelOn:     { color: C.restaurant.dark },

  amountRow:       { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.restaurant.border, borderRadius: 14, paddingHorizontal: 16, backgroundColor: C.restaurant.light },
  euroSign:        { fontSize: 30, fontWeight: '800', color: C.restaurant.muted, marginRight: 6 },
  amountInput:     { flex: 1, fontSize: 34, fontWeight: '800', color: C.gray[900], paddingVertical: 12 },

  logError:        { color: C.red, fontSize: 13, marginTop: 10 },
  logBtn:          { backgroundColor: C.restaurant.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  logBtnDisabled:  { backgroundColor: C.gray[300] },
  logBtnText:      { color: '#fff', fontWeight: '800', fontSize: 17 },

  flash:           { backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  flashText:       { color: '#15803d', fontWeight: '800', fontSize: 14 },

  detailsToggle:     { marginTop: 14, alignSelf: 'flex-start' },
  detailsToggleText: { fontSize: 13, fontWeight: '700', color: C.restaurant.muted },
  details:           { marginTop: 12, borderTopWidth: 1, borderTopColor: C.gray[100], paddingTop: 12 },
  detailLabel:       { fontSize: 12, fontWeight: '700', color: C.gray[500], marginBottom: 6, marginTop: 8 },
  qtyRow:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyInput:          { width: 90, borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '700', backgroundColor: C.gray[50] },
  unitRow:           { flexDirection: 'row', gap: 6, flex: 1 },
  unitChip:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  unitChipOn:        { backgroundColor: C.restaurant.primary, borderColor: C.restaurant.primary },
  unitChipText:      { fontSize: 13, fontWeight: '600', color: C.gray[600] },
  unitChipTextOn:    { color: '#fff' },
  tagWrap:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:               { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.gray[200], backgroundColor: '#fff' },
  tagOn:             { backgroundColor: C.restaurant.light, borderColor: C.restaurant.primary },
  tagText:           { fontSize: 12, color: C.gray[600] },
  tagTextOn:         { color: C.restaurant.dark, fontWeight: '700' },
  notesInput:        { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 60, backgroundColor: C.gray[50] },
});

// ── Plans styles ──────────────────────────────────────────────────
const p = StyleSheet.create({
  section:      { marginBottom: 12 },
  sectionHead:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.gray[900] },
  sectionSub:   { fontSize: 12, color: C.gray[500], marginTop: 2 },
  genBtn:       { backgroundColor: C.restaurant.dark, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  genBtnBusy:   { opacity: 0.7 },
  genBtnText:   { color: '#fff', fontWeight: '800', fontSize: 13 },
  genError:     { color: C.red, fontSize: 13, marginBottom: 10 },

  empty:        { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.gray[100] },
  emptyIcon:    { fontSize: 34, marginBottom: 8 },
  emptyTitle:   { fontSize: 15, fontWeight: '800', color: C.gray[800] },
  emptyBody:    { fontSize: 13, color: C.gray[500], marginTop: 4, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },

  groupLabel:   { fontSize: 11, fontWeight: '800', color: C.gray[400], textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6, marginBottom: 8 },

  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.gray[100] },
  cardHead:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prioDot:      { width: 8, height: 8, borderRadius: 4 },
  cardStaff:    { fontSize: 13, fontWeight: '800', color: C.gray[900] },
  prioTag:      { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: C.gray[800], marginTop: 3 },
  cardEuro:     { fontSize: 17, fontWeight: '800', color: C.restaurant.dark },
  cardSummary:  { fontSize: 13, color: C.gray[600], marginTop: 8, lineHeight: 19 },

  action:       { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'flex-start' },
  actionCheck:  { fontSize: 16, color: C.restaurant.primary },
  actionText:   { fontSize: 13, color: C.gray[800], lineHeight: 18 },
  actionDone:   { textDecorationLine: 'line-through', color: C.gray[400] },
  actionHint:   { fontSize: 11, color: C.gray[400], marginTop: 1 },

  cardFoot:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, borderTopWidth: 1, borderTopColor: C.gray[100], paddingTop: 10 },
  aiBadge:      { fontSize: 10, color: C.gray[400], flex: 1, fontStyle: 'italic' },
  approveBtn:   { backgroundColor: C.green, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  approveBtnBusy:{ opacity: 0.7 },
  approveBtnText:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  statusTag:    { fontSize: 12, fontWeight: '800', color: C.green },
});

const styles = StyleSheet.create({
  topBar: { padding: 16, paddingTop: 56, paddingBottom: 8 },
  title:  { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  sub:    { fontSize: 12, color: C.gray[500], marginTop: 2 },
});
