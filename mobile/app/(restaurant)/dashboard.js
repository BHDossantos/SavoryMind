import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import SafeScreen from '../../components/SafeScreen';
import MetricCard from '../../components/MetricCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';
import { formatEuro } from '../../utils/euro';
import { useFocusEffect, useRouter } from 'expo-router';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'dashboard.goodMorning';
  if (h < 17) return 'dashboard.goodAfternoon';
  return 'dashboard.goodEvening';
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router           = useRouter();
  const { t, i18n } = useTranslation();
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);
  const [actionPlan, setActionPlan] = useState([]);
  const [trending, setTrending] = useState(null);
  const [recovered, setRecovered] = useState(null);
  // AI-OS surfaces. All fetched silently — a data-less account should see
  // the rest of the dashboard, never an error, so each catch is swallowed.
  const [commandCenter, setCommandCenter] = useState(null);
  const [health, setHealth] = useState(null);
  const [resForecast, setResForecast] = useState(null);
  const [invForecast, setInvForecast] = useState(null);
  const [twin, setTwin] = useState(null);

  // Pull the billing status so we can surface a renew nudge when the
  // subscription lapses. Silent on failure — billing being off is fine.
  useEffect(() => {
    if (user?.account_type !== 'restaurant') return;
    api.getRestaurantBillingStatus().then(setBillingStatus).catch(() => {});
    api.getActionPlan().then((r) => setActionPlan(r?.actions || [])).catch(() => {});
    api.getTrending().then(setTrending).catch(() => {});
    // P2 coaching — money recovered this month for the counter. Silent on
    // failure so a coaching-less account doesn't see an error.
    api.getRecovered().then(setRecovered).catch(() => {});
    // AI-OS operator surfaces — command center hero, health score, the
    // tomorrow forecast strip and the digital-twin teaser.
    api.getCommandCenter().then(setCommandCenter).catch(() => {});
    api.getHealthScore().then(setHealth).catch(() => {});
    api.getReservationsForecast().then(setResForecast).catch(() => {});
    api.getInventoryForecast().then(setInvForecast).catch(() => {});
    api.getDigitalTwin().then(setTwin).catch(() => {});
  }, [user?.account_type]);

  const eur = (n, decimals = 0) => formatEuro(n || 0, i18n.language, { decimals });

  const BAND_LABEL = {
    excellent:       'aios.bandExcellent',
    good:            'aios.bandGood',
    fair:            'aios.bandFair',
    needs_attention: 'aios.bandNeedsAttention',
    learning:        'aios.bandLearning',
  };
  const BAND_COLOR = {
    excellent:       '#15803d',
    good:            C.green,
    fair:            C.amber,
    needs_attention: C.red,
    learning:        C.gray[400],
  };
  const DIMS = [
    ['financial',  'aios.dimFinancial'],
    ['operations', 'aios.dimOperations'],
    ['customer',   'aios.dimCustomer'],
    ['staff',      'aios.dimStaff'],
    ['marketing',  'aios.dimMarketing'],
  ];

  // Quick actions strip. Per-render so labels re-translate on language
  // switch; route/icon stay static.
  const QUICK_ACTIONS = [
    { icon: '📅',  label: t('restaurantFeatures.quickActionBookings'), route: '/bookings' },
    { icon: '👥',  label: t('restaurantFeatures.quickActionCrm'),      route: '/crm' },
    { icon: '🔮',  label: t('restaurantFeatures.quickActionForecast'), route: '/predictions' },
    { icon: '🗑️', label: t('restaurantFeatures.quickActionWaste'),    route: '/waste' },
    { icon: '⏱️', label: t('restaurantFeatures.quickActionKitchen'),  route: '/kitchen' },
    { icon: '🎓',  label: t('restaurantFeatures.quickActionTraining'), route: '/training' },
    { icon: '🧑‍🍳', label: t('restaurantFeatures.quickActionStaff'),  route: '/staff' },
    { icon: '📋',  label: t('restaurantFeatures.quickActionReports'),  route: '/reports' },
  ];

  const load = async () => {
    try {
      setStats((await api.getDashboardStats()) || {});  // 204 → {} so metric cards render zeros, not crash
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message={t('dashboard.loadingDashboard')} color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <SafeScreen onRefresh={load} refreshing={refreshing}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t(greetingKey())} 👋</Text>
          <Text style={styles.name}>{user?.display_name || t('common.restaurant')}</Text>
        </View>
        <Text onPress={logout} style={styles.logout}>{t('profile.signOut')}</Text>
      </View>

      {/* ── AI-OS: Command Center hero ─────────────────────────────────
          Operator's first glance: greeting, restaurant name, and a compact
          tile row. Honest about missing data — no fake €0 for yesterday. */}
      {commandCenter && (
        <View style={heroStyles.card}>
          <Text style={heroStyles.eyebrow}>{t('aios.commandCenterEyebrow')}</Text>
          <Text style={heroStyles.greeting}>{commandCenter.greeting}</Text>
          <Text style={heroStyles.name}>{commandCenter.restaurant_name || t('common.restaurant')}</Text>

          <View style={heroStyles.tiles}>
            <View style={heroStyles.tile}>
              <Text style={heroStyles.tileLabel}>{t('aios.yesterday')}</Text>
              {commandCenter.yesterday?.has_data ? (
                <>
                  <Text style={heroStyles.tileValue}>{eur(commandCenter.yesterday.revenue)}</Text>
                  <Text style={heroStyles.tileSub}>{eur(commandCenter.yesterday.profit)} {t('aios.profit')}</Text>
                </>
              ) : (
                <Text style={heroStyles.tileMuted}>{t('aios.noYesterdayData')}</Text>
              )}
            </View>

            <View style={heroStyles.tile}>
              <Text style={heroStyles.tileLabel}>{t('aios.rating')}</Text>
              <Text style={heroStyles.tileValue}>
                {commandCenter.rating != null ? `★ ${Number(commandCenter.rating).toFixed(1)}` : '—'}
              </Text>
            </View>

            <View style={heroStyles.tile}>
              <Text style={heroStyles.tileLabel}>{t('aios.reservations')}</Text>
              <Text style={heroStyles.tileValue}>{commandCenter.reservations_today ?? 0}</Text>
              <Text style={heroStyles.tileSub}>{commandCenter.covers_today ?? 0} {t('aios.covers')}</Text>
            </View>

            <View style={heroStyles.tile}>
              <Text style={heroStyles.tileLabel}>{t('aios.predictedToday')}</Text>
              <Text style={heroStyles.tileValue}>{eur(commandCenter.predicted_revenue_today)}</Text>
            </View>
          </View>

          {(commandCenter.inventory_alerts > 0 || commandCenter.staff_shortages > 0 || commandCenter.recommendations > 0) && (
            <View style={heroStyles.chips}>
              {commandCenter.inventory_alerts > 0 && (
                <View style={[heroStyles.chip, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[heroStyles.chipText, { color: '#b91c1c' }]}>📦 {t('aios.inventoryAlerts', { count: commandCenter.inventory_alerts })}</Text>
                </View>
              )}
              {commandCenter.staff_shortages > 0 && (
                <View style={[heroStyles.chip, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <Text style={[heroStyles.chipText, { color: '#b45309' }]}>🧑‍🍳 {t('aios.staffShortages', { count: commandCenter.staff_shortages })}</Text>
                </View>
              )}
              {commandCenter.recommendations > 0 && (
                <View style={[heroStyles.chip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <Text style={[heroStyles.chipText, { color: '#1d4ed8' }]}>💡 {t('aios.recommendations', { count: commandCenter.recommendations })}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── AI-OS: Health Score card ───────────────────────────────────
          Big overall number + band, plus tiny per-dimension bars. Skips
          dimensions still in "unknown" status so we never show a fake 0. */}
      {health && (
        <View style={healthStyles.card}>
          <View style={healthStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={healthStyles.title}>{t('aios.healthTitle')}</Text>
              <Text style={healthStyles.subtitle}>{t('aios.healthSubtitle')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[healthStyles.overall, { color: BAND_COLOR[health.band] || C.gray[500] }]}>
                {health.overall != null ? Math.round(health.overall) : '—'}
              </Text>
              <Text style={[healthStyles.band, { color: BAND_COLOR[health.band] || C.gray[500] }]}>
                {health.overall == null
                  ? t('aios.healthLearning')
                  : t(BAND_LABEL[health.band] || 'aios.bandLearning')}
              </Text>
            </View>
          </View>

          {DIMS.map(([key, label]) => {
            const dim = health.dimensions?.[key];
            if (!dim || dim.status === 'unknown' || dim.score == null) return null;
            const pct = Math.max(0, Math.min(100, dim.score));
            return (
              <View key={key} style={healthStyles.dimRow}>
                <Text style={healthStyles.dimLabel}>{t(label)}</Text>
                <View style={healthStyles.barTrack}>
                  <View style={[healthStyles.barFill, { width: `${pct}%`, backgroundColor: BAND_COLOR[health.band] || C.restaurant.primary }]} />
                </View>
                <Text style={healthStyles.dimScore}>{Math.round(dim.score)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── AI-OS: Tomorrow forecast strip ─────────────────────────────
          Hidden entirely when tomorrow has no basis to forecast from. */}
      {(resForecast?.has_data || (invForecast?.reorder_soon?.length > 0)) && (
        <View style={forecastStyles.card}>
          {resForecast?.has_data && (
            <Text style={forecastStyles.line}>
              <Text style={forecastStyles.lead}>{t('aios.tomorrowTitle')}: </Text>
              {t('aios.tomorrowForecast', {
                covers: resForecast.predicted_covers ?? 0,
                revenue: eur(resForecast.expected_revenue),
              })}
            </Text>
          )}
          {invForecast?.reorder_soon?.length > 0 && (
            <Text style={forecastStyles.reorder}>
              🛒 {t('aios.reorderLine', { count: invForecast.reorder_soon.length })}
            </Text>
          )}
        </View>
      )}

      {/* ── AI-OS: Digital Twin teaser → full snapshot screen ──────────── */}
      {twin && (
        <TouchableOpacity
          style={twinStyles.card}
          onPress={() => router.push('/digital-twin')}
          activeOpacity={0.85}
        >
          <Text style={twinStyles.emoji}>🧬</Text>
          <View style={{ flex: 1 }}>
            <Text style={twinStyles.eyebrow}>{t('aios.twinEyebrow')}</Text>
            <Text style={twinStyles.headline} numberOfLines={2}>{twin.headline || t('aios.twinTitle')}</Text>
            <Text style={twinStyles.hint}>{t('aios.twinTapHint')}</Text>
          </View>
          <Text style={twinStyles.arrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Lapsed-subscription nudge — parity with web restaurant dashboard.
          Surfaces only when billing is configured AND the subscription has
          past_due/canceled status, so paying / free-trial restaurants don't
          see noise. */}
      {billingStatus?.billing_configured && billingStatus?.subscription_status &&
       ['past_due', 'canceled', 'unpaid'].includes(billingStatus.subscription_status) && (
        <TouchableOpacity
          style={lapsedStyles.card}
          onPress={() => router.push('/billing')}
          activeOpacity={0.8}
        >
          <Text style={lapsedStyles.icon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={lapsedStyles.title}>{t('restaurantDashboard.lapsedTitle')}</Text>
            <Text style={lapsedStyles.sub}>{t('restaurantDashboard.lapsedSub')}</Text>
          </View>
          <Text style={lapsedStyles.arrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* What's trending — sales momentum (ML velocity from POS data). */}
      {trending && trending.has_data && ((trending.rising?.length > 0) || (trending.falling?.length > 0)) && (
        <View style={trendStyles.section}>
          <Text style={trendStyles.eyebrow}>{t('restaurantDashboard.trendingEyebrow')}</Text>
          <Text style={trendStyles.title}>📈 {t('restaurantDashboard.trendingTitle')}</Text>
          {trending.rising.slice(0, 3).map((r) => (
            <View key={`up${r.item}`} style={trendStyles.row}>
              <Text style={trendStyles.item}>{r.trend === 'new' ? '✨' : '🔥'} {r.item}</Text>
              <Text style={trendStyles.up}>{r.velocity > 0 ? `+${r.velocity}` : r.velocity} · {r.momentum}×</Text>
            </View>
          ))}
          {trending.falling.slice(0, 1).map((r) => (
            <View key={`dn${r.item}`} style={trendStyles.row}>
              <Text style={trendStyles.itemDim}>📉 {r.item}</Text>
              <Text style={trendStyles.down}>{r.velocity}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Today's AI Action Plan — the operator's first decision surface. */}
      {actionPlan.length > 0 && (
        <View style={actionStyles.section}>
          <View style={actionStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={actionStyles.eyebrow}>{t('restaurantDashboard.actionPlanEyebrow')}</Text>
              <Text style={actionStyles.title}>{t('restaurantDashboard.actionPlanTitle')}</Text>
            </View>
            <Text style={{ fontSize: 22 }}>🎯</Text>
          </View>
          {actionPlan.map((a, idx) => {
            const sev = a.severity || 'medium';
            const bg = sev === 'high' ? '#fef2f2' : sev === 'low' ? '#f0fdf4' : '#fffbeb';
            const bd = sev === 'high' ? '#fecaca' : sev === 'low' ? '#86efac' : '#fde68a';
            return (
              <TouchableOpacity
                key={`${a.kind}-${idx}`}
                style={[actionStyles.card, { backgroundColor: bg, borderColor: bd }]}
                onPress={() => a.cta_route && router.push(a.cta_route.replace('/restaurant', ''))}
                activeOpacity={0.85}
              >
                <Text style={actionStyles.icon}>{a.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={actionStyles.cardTitle}>{a.title}</Text>
                  <Text style={actionStyles.cardBody} numberOfLines={2}>{a.body}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {a.estimated_gain > 0 && (
                    <Text style={actionStyles.gain}>+${a.estimated_gain.toFixed(0)}</Text>
                  )}
                  <Text style={actionStyles.cta}>{a.cta_label} →</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Quick actions grid */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((q) => (
          <TouchableOpacity
            key={q.label}
            style={styles.quickCard}
            onPress={() => router.push(q.route)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickIcon}>{q.icon}</Text>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Flavor — same AI assistant the consumer side uses. Restaurant
          operators ask it about menu engineering, pairings on the wine
          list, fixes for tough dishes. Routes into the (consumer)
          assistant screen; backend opened up to all logged-in users. */}
      <TouchableOpacity
        style={flavorStyles.card}
        onPress={() => router.push('/(consumer)/assistant')}
        activeOpacity={0.85}
      >
        <Text style={flavorStyles.emoji}>👨‍🍳</Text>
        <View style={{ flex: 1 }}>
          <Text style={flavorStyles.title}>{t('dashboard.askFlavor')}</Text>
          <Text style={flavorStyles.sub}>{t('dashboard.askFlavorSub')}</Text>
        </View>
        <Text style={flavorStyles.arrow}>→</Text>
      </TouchableOpacity>

      <Text style={styles.section}>{t('dashboard.last30Days')}</Text>

      <MetricCard label={t('dashboard.totalRevenue')}     value={eur(stats.total_revenue)}                            accent={C.restaurant.primary} />
      <MetricCard label={t('dashboard.totalOrders')}      value={(stats.total_orders || 0).toLocaleString()}          accent={C.restaurant.dark} />
      <MetricCard label={t('dashboard.avgOrderValue')}    value={eur(stats.avg_order_value, 2)}                       accent="#f59e0b" />
      <MetricCard label={t('dashboard.avgProfitMargin')}  value={`${(stats.avg_profit_margin || 0).toFixed(1)}%`}     accent={C.green} />
      <MetricCard label={t('dashboard.avgRating')}        value={`⭐ ${(stats.avg_rating || 0).toFixed(1)}`}          accent="#8b5cf6" />
      {stats.top_item && (
        <MetricCard label={t('dashboard.topSeller')} value={stats.top_item} sub={t('dashboard.topSellerSub')} accent="#0d9488" />
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting:   { fontSize: 13, color: C.gray[500] },
  name:       { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  logout:     { fontSize: 13, color: C.gray[400], marginTop: 4 },
  quickGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickCard:  { width: '22%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.gray[100] },
  quickIcon:  { fontSize: 22, marginBottom: 4 },
  quickLabel: { fontSize: 10, fontWeight: '700', color: C.gray[600], textAlign: 'center' },
  section:    { fontSize: 13, fontWeight: '600', color: C.gray[500], marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const actionStyles = StyleSheet.create({
  section:    { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eyebrow:    { fontSize: 10, fontWeight: '700', color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.6 },
  title:      { fontSize: 16, fontWeight: '800', color: '#1f2937', marginTop: 2 },
  card:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 6 },
  icon:       { fontSize: 20 },
  cardTitle:  { fontSize: 13, fontWeight: '700', color: C.gray[900] },
  cardBody:   { fontSize: 11, color: C.gray[600], marginTop: 2 },
  gain:       { fontSize: 11, fontWeight: '800', color: '#15803d' },
  cta:        { fontSize: 10, fontWeight: '700', color: C.restaurant.primary, marginTop: 2 },
});

const lapsedStyles = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  icon:  { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  sub:   { fontSize: 11, color: '#b45309', marginTop: 2 },
  arrow: { fontSize: 18, color: '#92400e', fontWeight: '700' },
});

const flavorStyles = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.restaurant.primary, borderRadius: 16, padding: 16, marginBottom: 24 },
  emoji:   { fontSize: 32 },
  title:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  sub:     { fontSize: 12, color: '#fff', opacity: 0.85, marginTop: 2, lineHeight: 16 },
  arrow:   { fontSize: 20, color: '#fff', fontWeight: '700' },
});

const heroStyles = StyleSheet.create({
  card:      { backgroundColor: '#fff', borderColor: C.restaurant.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  eyebrow:   { fontSize: 10, fontWeight: '700', color: C.restaurant.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  greeting:  { fontSize: 13, color: C.gray[500], marginTop: 6 },
  name:      { fontSize: 20, fontWeight: '800', color: C.gray[900], marginBottom: 12 },
  tiles:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile:      { flexGrow: 1, flexBasis: '46%', backgroundColor: C.restaurant.light, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  tileLabel: { fontSize: 10, fontWeight: '700', color: C.restaurant.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValue: { fontSize: 17, fontWeight: '800', color: C.gray[900], marginTop: 2 },
  tileSub:   { fontSize: 11, color: C.gray[500], marginTop: 1 },
  tileMuted: { fontSize: 12, fontWeight: '600', color: C.gray[400], marginTop: 4 },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip:      { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText:  { fontSize: 11, fontWeight: '700' },
});

const healthStyles = StyleSheet.create({
  card:     { backgroundColor: '#fff', borderColor: C.gray[100], borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  header:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title:    { fontSize: 16, fontWeight: '800', color: C.gray[900] },
  subtitle: { fontSize: 11, color: C.gray[500], marginTop: 2 },
  overall:  { fontSize: 34, fontWeight: '900', lineHeight: 38 },
  band:     { fontSize: 12, fontWeight: '700', marginTop: 2 },
  dimRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dimLabel: { fontSize: 11, fontWeight: '600', color: C.gray[600], width: 80 },
  barTrack: { flex: 1, height: 8, backgroundColor: C.gray[100], borderRadius: 999, overflow: 'hidden' },
  barFill:  { height: 8, borderRadius: 999 },
  dimScore: { fontSize: 11, fontWeight: '700', color: C.gray[500], width: 26, textAlign: 'right' },
});

const forecastStyles = StyleSheet.create({
  card:    { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  line:    { fontSize: 13, color: C.gray[700], lineHeight: 18 },
  lead:    { fontWeight: '800', color: '#3730a3' },
  reorder: { fontSize: 12, fontWeight: '600', color: '#4338ca', marginTop: 6 },
});

const twinStyles = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 16 },
  emoji:    { fontSize: 30 },
  eyebrow:  { fontSize: 10, fontWeight: '700', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: 0.6 },
  headline: { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 2, lineHeight: 19 },
  hint:     { fontSize: 11, color: C.gray[400], marginTop: 3 },
  arrow:    { fontSize: 20, color: '#fff', fontWeight: '700' },
});

const trendStyles = StyleSheet.create({
  section: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: 0.6 },
  title:   { fontSize: 16, fontWeight: '800', color: '#1f2937', marginTop: 2, marginBottom: 8 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderColor: '#d1fae5', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  item:    { fontSize: 13, fontWeight: '700', color: C.gray[900], flex: 1 },
  itemDim: { fontSize: 13, fontWeight: '500', color: C.gray[500], flex: 1 },
  up:      { fontSize: 12, fontWeight: '800', color: '#047857' },
  down:    { fontSize: 12, fontWeight: '800', color: C.gray[400] },
});
