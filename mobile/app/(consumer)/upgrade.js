/**
 * Consumer Premium upgrade — parity with frontend/src/pages/consumer/upgrade.js.
 *
 * $9.99/mo for the unlocked Planner, Pairings, Music, Cellar surfaces.
 * Native opens Stripe Checkout / Portal via expo-web-browser; on return
 * the screen polls for the webhook to land.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../constants/colors';

const PRICE_LABEL = '$9.99';

export default function UpgradeScreen() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const isPremium = user?.plan === 'premium';
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getBillingStatus();
      setStatus(s);
      if (s.is_premium && !isPremium) updateUser({ plan: 'premium' });
      return s;
    } catch (e) { setError(e.message); return null; }
  }, [isPremium, updateUser]);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []); // eslint-disable-line
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const startSync = () => {
    if (syncing) return;
    setSyncing(true);
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const s = await refresh();
      if ((s && s.is_premium) || tries >= 5) {
        clearInterval(timer); setSyncing(false);
      }
    }, 2500);
  };

  const open = async (url) => { await WebBrowser.openBrowserAsync(url); };

  const startCheckout = async () => {
    setActionLoading(true); setError(null);
    try {
      const { url } = await api.createCheckout();
      await open(url);
      startSync();
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  const openPortal = async () => {
    setActionLoading(true); setError(null);
    try {
      const { url } = await api.createBillingPortal();
      await open(url);
    } catch (e) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  if (loading) return <LoadingSpinner message={t('common.loading')} color={C.consumer.primary} />;

  const premium = (status && status.is_premium) || isPremium;
  const billingLive = status?.billing_configured;
  const trialDays = status?.trial_days || 0;
  const periodEnd = status?.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString(i18n.language)
    : null;
  const pricePeriod = t('upgradePage.period');

  const FEATURES = [
    { icon: '📅', title: t('upgradePage.features.plannerTitle'), desc: t('upgradePage.features.plannerDesc') },
    { icon: '🍷', title: t('upgradePage.features.pairingsTitle'), desc: t('upgradePage.features.pairingsDesc') },
    { icon: '🎵', title: t('upgradePage.features.musicTitle'), desc: t('upgradePage.features.musicDesc') },
    { icon: '🥂', title: t('upgradePage.features.cellarTitle'), desc: t('upgradePage.features.cellarDesc') },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 60 }}>
      <Text style={styles.title}>{t('upgradePage.title')}</Text>
      <Text style={styles.subtitle}>{t('upgradePage.subtitle')}</Text>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {premium ? (
        <View style={styles.proCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 28 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.proHeadline}>{t('upgradePage.onPremium')}</Text>
              <Text style={styles.proSub}>
                {status?.subscription_status === 'trialing'
                  ? `${t('upgradePage.trialActive')}${periodEnd ? ' ' + t('upgradePage.trialEnds', { date: periodEnd }) : ''}`
                  : `${t('upgradePage.subActive')}${periodEnd ? ' ' + t('upgradePage.renews', { date: periodEnd }) : ''}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={openPortal} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('upgradePage.manageSub')}</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>{t('upgradePage.manageHint')}</Text>
        </View>
      ) : (
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeHeader}>
            <Text style={styles.upgradeLabel}>{t('upgradePage.planLabel')}</Text>
            {trialDays > 0 && <Text style={styles.upgradeTrial}>{t('upgradePage.trialThen', { days: trialDays })}</Text>}
            <Text style={styles.upgradePrice}>
              {PRICE_LABEL}<Text style={styles.upgradePeriod}>{pricePeriod}</Text>
            </Text>
          </View>
          <View style={{ padding: 18 }}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.primaryBtn, !billingLive && { opacity: 0.5 }]}
              onPress={startCheckout}
              disabled={actionLoading || !billingLive}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>
                    {trialDays > 0
                      ? t('upgradePage.startTrial', { days: trialDays })
                      : t('upgradePage.upgradeCta', { price: PRICE_LABEL, period: pricePeriod })}
                  </Text>}
            </TouchableOpacity>
            {!billingLive && <Text style={styles.warn}>{t('upgradePage.billingOff')}</Text>}
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 8 }]}>{t('upgradePage.secureFootnote')}</Text>
          </View>
        </View>
      )}

      {syncing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <ActivityIndicator color={C.consumer.primary} />
          <Text style={{ fontSize: 12, color: C.gray[500] }}>{t('upgradePage.successActivating')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:        { fontSize: 24, fontWeight: '800', color: C.gray[900] },
  subtitle:     { fontSize: 13, color: C.gray[500], marginTop: 4, marginBottom: 20 },
  errorBox:     { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText:    { color: '#b91c1c', fontSize: 13 },
  proCard:      { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.consumer.border, padding: 18 },
  proHeadline:  { fontSize: 16, fontWeight: '700', color: C.gray[900] },
  proSub:       { fontSize: 12, color: C.gray[500], marginTop: 2 },
  primaryBtn:   { backgroundColor: C.consumer.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  hint:         { fontSize: 11, color: C.gray[400], marginTop: 8 },
  upgradeCard:  { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.consumer.border, overflow: 'hidden' },
  upgradeHeader:{ backgroundColor: C.consumer.dark, padding: 20 },
  upgradeLabel: { color: '#e9d5ff', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  upgradeTrial: { color: '#e9d5ff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  upgradePrice: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  upgradePeriod:{ color: '#e9d5ff', fontSize: 14, fontWeight: '500' },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  featureIcon:  { fontSize: 20 },
  featureTitle: { fontSize: 13, fontWeight: '700', color: C.gray[900] },
  featureDesc:  { fontSize: 11, color: C.gray[500], marginTop: 2 },
  warn:         { color: '#b45309', fontSize: 11, textAlign: 'center', marginTop: 6 },
});
