import { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import SafeScreen from '../../components/SafeScreen';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { api } from '../../services/api';
import { C } from '../../constants/colors';
import { formatEuro } from '../../utils/euro';

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

// today_actions come from the same coaching engine the dashboard uses, but
// the shape isn't guaranteed — read defensively so a schema tweak on the
// backend never crashes the screen.
function actionTitle(a) {
  if (typeof a === 'string') return a;
  return a?.title || a?.label || a?.action || '';
}
function actionBody(a) {
  return a?.body || a?.description || a?.detail || '';
}
function actionGain(a) {
  const g = a?.estimated_gain ?? a?.gain ?? a?.value ?? a?.euro_impact;
  return typeof g === 'number' && g > 0 ? g : null;
}

export default function DigitalTwin() {
  const { t, i18n } = useTranslation();
  const [twin, setTwin]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const eur = (n, decimals = 0) => formatEuro(n || 0, i18n.language, { decimals });

  const load = async () => {
    try {
      setTwin(await api.getDigitalTwin());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <LoadingSpinner message={t('aios.loading')} color={C.restaurant.primary} />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;
  if (!twin) {
    return (
      <SafeScreen>
        <Text style={styles.empty} testID="twin-empty">{t('aios.empty')}</Text>
      </SafeScreen>
    );
  }

  const wh   = twin.what_happened || {};
  const why  = twin.why || {};
  const tom  = twin.tomorrow || {};
  const res  = tom.reservations || {};
  const acts = Array.isArray(twin.today_actions) ? twin.today_actions : [];
  const health = twin.health || {};

  const resCount   = res.predicted_reservations ?? res.reservations ?? null;
  const coversCount = res.predicted_covers ?? res.covers ?? null;
  const walkIns    = res.predicted_walk_ins ?? res.walk_ins ?? null;

  return (
    <SafeScreen onRefresh={load} refreshing={false}>
      <Text style={styles.eyebrow}>{t('aios.twinEyebrow')}</Text>
      <Text style={styles.headline}>{twin.headline || t('aios.twinTitle')}</Text>
      {twin.restaurant_name ? <Text style={styles.name}>{twin.restaurant_name}</Text> : null}

      {/* What happened */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('aios.whatHappened')}</Text>
        {wh.has_data ? (
          <View style={styles.whRow}>
            <View style={styles.whMain}>
              <Text style={styles.whRevenue}>{eur(wh.revenue)}</Text>
              <Text style={styles.whSub}>{eur(wh.profit)} {t('aios.profit')}</Text>
            </View>
            {wh.weekday_baseline != null && (
              <View style={styles.whBaseline}>
                <Text style={styles.whBaselineLabel}>{t('aios.weekdayBaseline')}</Text>
                <Text style={styles.whBaselineValue}>{eur(wh.weekday_baseline)}</Text>
                <Text style={styles.whVs}>{t('aios.vsBaseline')}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.muted}>{t('aios.noYesterdayData')}</Text>
        )}
      </View>

      {/* Why */}
      {(why.narrative || (why.drivers && why.drivers.length > 0)) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aios.why')}</Text>
          {why.narrative ? (
            <Text style={styles.narrative}>{why.narrative}</Text>
          ) : null}
          {(why.drivers || []).map((d, i) => (
            <View key={i} style={styles.driverRow}>
              <Text style={styles.driverDot}>•</Text>
              <Text style={styles.driverText}>{typeof d === 'string' ? d : (d?.label || d?.text || '')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tomorrow */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('aios.tomorrowTitle')}</Text>
        <View style={styles.tomGrid}>
          {resCount != null && (
            <View style={styles.tomTile}>
              <Text style={styles.tomValue}>{resCount}</Text>
              <Text style={styles.tomLabel}>{t('aios.reservationsLabel')}</Text>
            </View>
          )}
          {coversCount != null && (
            <View style={styles.tomTile}>
              <Text style={styles.tomValue}>{coversCount}</Text>
              <Text style={styles.tomLabel}>{t('aios.coversLabel')}</Text>
            </View>
          )}
          {walkIns != null && (
            <View style={styles.tomTile}>
              <Text style={styles.tomValue}>{walkIns}</Text>
              <Text style={styles.tomLabel}>{t('aios.walkInsLabel')}</Text>
            </View>
          )}
        </View>
        {tom.predicted_sales_revenue != null && (
          <View style={styles.salesRow}>
            <Text style={styles.salesLabel}>{t('aios.predictedSales')}</Text>
            <Text style={styles.salesValue}>{eur(tom.predicted_sales_revenue)}</Text>
          </View>
        )}
      </View>

      {/* Today's actions */}
      {acts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aios.todayActions')}</Text>
          {acts.map((a, i) => {
            const gain = actionGain(a);
            return (
              <View key={i} style={styles.actionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{actionTitle(a)}</Text>
                  {actionBody(a) ? <Text style={styles.actionBody} numberOfLines={2}>{actionBody(a)}</Text> : null}
                </View>
                {gain != null && <Text style={styles.actionGain}>+{eur(gain)}</Text>}
              </View>
            );
          })}
          {twin.today_action_value > 0 && (
            <Text style={styles.actionTotal}>+{eur(twin.today_action_value)}</Text>
          )}
        </View>
      )}

      {/* Overall health */}
      {(health.overall != null || health.band) && (
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>{t('aios.healthSection')}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.healthOverall, { color: BAND_COLOR[health.band] || C.gray[500] }]}>
              {health.overall != null ? Math.round(health.overall) : '—'}
            </Text>
            <Text style={[styles.healthBand, { color: BAND_COLOR[health.band] || C.gray[500] }]}>
              {health.overall == null
                ? t('aios.healthLearning')
                : t(BAND_LABEL[health.band] || 'aios.bandLearning')}
            </Text>
          </View>
        </View>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  empty:      { textAlign: 'center', color: C.gray[500], marginTop: 40, fontSize: 14 },
  eyebrow:    { fontSize: 11, fontWeight: '700', color: C.restaurant.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  headline:   { fontSize: 22, fontWeight: '900', color: C.gray[900], marginTop: 6 },
  name:       { fontSize: 13, color: C.gray[500], marginTop: 2, marginBottom: 8 },

  section:      { backgroundColor: '#fff', borderColor: C.gray[100], borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  muted:        { fontSize: 13, color: C.gray[400], fontWeight: '600' },

  whRow:          { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  whMain:         { flex: 1 },
  whRevenue:      { fontSize: 28, fontWeight: '900', color: C.gray[900] },
  whSub:          { fontSize: 12, color: C.gray[500], marginTop: 2 },
  whBaseline:     { alignItems: 'flex-end' },
  whBaselineLabel:{ fontSize: 10, fontWeight: '700', color: C.gray[400], textTransform: 'uppercase' },
  whBaselineValue:{ fontSize: 16, fontWeight: '800', color: C.gray[600], marginTop: 2 },
  whVs:           { fontSize: 10, color: C.gray[400], marginTop: 1 },

  narrative:  { fontSize: 14, color: C.gray[700], lineHeight: 20, marginBottom: 8 },
  driverRow:  { flexDirection: 'row', gap: 8, marginBottom: 4 },
  driverDot:  { fontSize: 14, color: C.restaurant.primary },
  driverText: { flex: 1, fontSize: 13, color: C.gray[600], lineHeight: 18 },

  tomGrid:    { flexDirection: 'row', gap: 8 },
  tomTile:    { flex: 1, backgroundColor: C.restaurant.light, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  tomValue:   { fontSize: 20, fontWeight: '900', color: C.restaurant.dark },
  tomLabel:   { fontSize: 10, fontWeight: '700', color: C.restaurant.muted, marginTop: 2, textTransform: 'uppercase' },
  salesRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  salesLabel: { fontSize: 13, fontWeight: '600', color: C.gray[600] },
  salesValue: { fontSize: 16, fontWeight: '800', color: C.gray[900] },

  actionCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.gray[50], borderRadius: 12, padding: 12, marginBottom: 6 },
  actionTitle: { fontSize: 13, fontWeight: '700', color: C.gray[900] },
  actionBody:  { fontSize: 11, color: C.gray[600], marginTop: 2 },
  actionGain:  { fontSize: 13, fontWeight: '800', color: '#15803d' },
  actionTotal: { fontSize: 13, fontWeight: '800', color: '#15803d', textAlign: 'right', marginTop: 4 },

  healthRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderColor: C.gray[100], borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  healthLabel:   { fontSize: 13, fontWeight: '700', color: C.gray[600] },
  healthOverall: { fontSize: 30, fontWeight: '900', lineHeight: 34 },
  healthBand:    { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
