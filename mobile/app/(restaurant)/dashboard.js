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
  const { t } = useTranslation();
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);
  const [actionPlan, setActionPlan] = useState([]);
  const [trending, setTrending] = useState(null);
  const [recovered, setRecovered] = useState(null);

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
  }, [user?.account_type]);

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
      setStats(await api.getDashboardStats());
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
      {trending && trending.has_data && (trending.rising.length > 0 || trending.falling.length > 0) && (
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
                onPress={() => router.push(a.cta_route.replace('/restaurant', ''))}
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

      <MetricCard label={t('dashboard.totalRevenue')}     value={`$${(stats.total_revenue || 0).toLocaleString()}`}   accent={C.restaurant.primary} />
      <MetricCard label={t('dashboard.totalOrders')}      value={(stats.total_orders || 0).toLocaleString()}          accent={C.restaurant.dark} />
      <MetricCard label={t('dashboard.avgOrderValue')}    value={`$${(stats.avg_order_value || 0).toFixed(2)}`}       accent="#f59e0b" />
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
